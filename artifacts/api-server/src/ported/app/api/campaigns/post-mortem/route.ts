import { HttpResponse } from "@server/http-response"

import { recordOrchestratedCall } from "@/lib/ai/metering"
import { generateTextWithFallback } from "@/lib/ai/orchestrator"
import { postMortemSchema } from "@/lib/campaigns/ledger"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

async function synthesizeTakeaway(input: {
  outcomeRating: string
  whatWorked: string
  whatDidntWork: string
}): Promise<{
  text: string | null
  model: Awaited<ReturnType<typeof generateTextWithFallback>>["model"] | null
  usage: unknown
}> {
  const worked = input.whatWorked.trim()
  const failed = input.whatDidntWork.trim()
  if (!worked && !failed) {
    return { text: null, model: null, usage: null }
  }

  const { text, model, usage } = await generateTextWithFallback({
    prompt: [
      `You are an AI Chief Marketing Officer. Summarize this debrief into a strict, single-sentence operational rule for future campaign prompts:`,
      `Outcome: ${input.outcomeRating}`,
      `What Worked: ${worked || "(not provided)"}`,
      `What Didn't Land: ${failed || "(not provided)"}`,
      `Output ONLY the 1-sentence directive.`,
    ].join("\n"),
  })

  const cleaned = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  return { text: cleaned || null, model, usage }
}

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
    const parsed = postMortemSchema.safeParse(body)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid post-mortem payload." },
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
        { error: "You need creator or manager access to save a debrief." },
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

    const startTime = Date.now()
    const {
      text: aiTakeaway,
      model,
      usage,
    } = await synthesizeTakeaway({
      outcomeRating: input.outcomeRating,
      whatWorked: input.whatWorked,
      whatDidntWork: input.whatDidntWork,
    })
    const durationMs = Date.now() - startTime

    if (model) {
      await recordOrchestratedCall({
        entityId: input.entityId,
        agentType: "post_mortem",
        agentLabel: "Post-Mortem Trainer",
        model,
        usage,
        durationMs,
        summary: aiTakeaway?.slice(0, 140) ?? input.outcomeRating,
        metadata: {
          campaignId: input.campaignId,
          outcomeRating: input.outcomeRating,
        },
      })
    }

    const { data: updated, error: updateError } = await supabase
      .from("campaigns")
      .update({
        outcome_rating: input.outcomeRating,
        what_worked: input.whatWorked.trim() || null,
        what_didnt_work: input.whatDidntWork.trim() || null,
        ai_takeaway: aiTakeaway,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.campaignId)
      .select(
        "id, outcome_rating, what_worked, what_didnt_work, ai_takeaway, updated_at"
      )
      .single()

    if (updateError || !updated) {
      return HttpResponse.json(
        { error: updateError?.message ?? "Failed to save post-mortem." },
        { status: 500 }
      )
    }

    await supabase.from("activity_logs").insert({
      entity_id: input.entityId,
      user_id: user.id,
      action: "saved_post_mortem",
      details: {
        campaign_id: input.campaignId,
        outcome_rating: input.outcomeRating,
        ai_takeaway: aiTakeaway,
      },
    })

    return HttpResponse.json({ campaign: updated })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save post-mortem."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
