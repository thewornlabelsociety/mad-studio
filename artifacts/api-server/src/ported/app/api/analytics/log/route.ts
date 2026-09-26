import { HttpResponse } from "@server/http-response"

import { logAnalyticsSchema } from "@/lib/campaigns/ledger"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = logAnalyticsSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid analytics payload." },
        { status: 400 }
      )
    }

    const input = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: input.entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )

    if (accessError) {
      return HttpResponse.json({ error: accessError.message }, { status: 500 })
    }

    if (!canEdit) {
      return HttpResponse.json(
        { error: "You need creator or manager access to log numbers." },
        { status: 403 }
      )
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, entity_id")
      .eq("id", input.campaignId)
      .eq("entity_id", input.entityId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return HttpResponse.json(
        { error: campaignError?.message ?? "Campaign not found." },
        { status: 404 }
      )
    }

    const today = new Date().toISOString().slice(0, 10)

    const { data: existing } = await supabase
      .from("ad_analytics")
      .select("id")
      .eq("campaign_id", input.campaignId)
      .eq("reporting_date", today)
      .maybeSingle()

    const payload = {
      campaign_id: input.campaignId,
      entity_id: input.entityId,
      spend: input.spend,
      revenue: input.revenue,
      conversions_count: input.conversionsCount,
      impressions: input.impressions ?? 0,
      clicks: input.clicks ?? 0,
      notes: input.notes?.trim() || null,
      reporting_date: today,
      updated_at: new Date().toISOString(),
    }

    const write = existing
      ? await supabase
          .from("ad_analytics")
          .update(payload)
          .eq("id", existing.id)
          .select(
            "id, campaign_id, entity_id, spend, revenue, conversions_count, impressions, clicks, net_profit, roas, cpa, ctr, cpc, notes, reporting_date"
          )
          .single()
      : await supabase
          .from("ad_analytics")
          .insert(payload)
          .select(
            "id, campaign_id, entity_id, spend, revenue, conversions_count, impressions, clicks, net_profit, roas, cpa, ctr, cpc, notes, reporting_date"
          )
          .single()

    if (write.error || !write.data) {
      return HttpResponse.json(
        { error: write.error?.message ?? "Failed to save analytics." },
        { status: 500 }
      )
    }

    await supabase.from("activity_logs").insert({
      entity_id: input.entityId,
      user_id: user.id,
      action: "logged_roi",
      details: {
        campaign_id: input.campaignId,
        analytics_id: write.data.id,
        spend: input.spend,
        revenue: input.revenue,
        conversions_count: input.conversionsCount,
      },
    })

    return HttpResponse.json({ analytics: write.data })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log analytics."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
