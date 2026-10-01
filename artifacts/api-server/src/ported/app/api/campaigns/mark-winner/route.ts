import { HttpResponse } from "@server/http-response"

import {
  extractHookBlueprintFromPack,
  markWinnerSchema,
} from "@/lib/campaigns/ledger"
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
    const parsed = markWinnerSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid mark-winner payload." },
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
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, entity_id, target_segment, asset_pack")
      .eq("id", input.campaignId)
      .eq("entity_id", input.entityId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return HttpResponse.json({ error: "Campaign not found." }, { status: 404 })
    }

    const hook = extractHookBlueprintFromPack(campaign.asset_pack)
    const audience = campaign.target_segment?.trim() || "General audience"
    const whatWorked = [
      hook ? `Hook blueprint: ${hook}` : null,
      `Audience segment: ${audience}`,
    ]
      .filter(Boolean)
      .join("\n")

    const takeaway = input.userTakeaway.trim()

    const { data: updated, error: updateError } = await supabase
      .from("campaigns")
      .update({
        outcome_rating: "winner",
        what_worked: whatWorked,
        ai_takeaway: takeaway,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.campaignId)
      .select(
        "id, outcome_rating, what_worked, what_didnt_work, ai_takeaway, target_segment"
      )
      .single()

    if (updateError || !updated) {
      return HttpResponse.json(
        { error: updateError?.message ?? "Could not mark winner." },
        { status: 500 }
      )
    }

    await supabase.from("activity_logs").insert({
      entity_id: input.entityId,
      user_id: user.id,
      action: "marked_campaign_winner",
      details: {
        campaign_id: input.campaignId,
        ai_takeaway: takeaway,
        hook,
        audience,
      },
    })

    return HttpResponse.json({ campaign: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mark winner failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
