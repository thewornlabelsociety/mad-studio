import type { Json } from "@/lib/database.types"
import { generateCampaignPackCore } from "@/lib/campaigns/generate-campaign-pack-core"
import type {
  CampaignProgramDayRow,
  CampaignProgramRow,
} from "@/lib/campaigns/program-types"
import { resolveProgramDayAsset } from "@/lib/campaigns/resolve-program-day-asset"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type ProgramDayPackSnapshot = {
  pack: unknown
  preview: unknown
  campaignId: string | null
  intent: string
  attachedImageUrl: string | null
  fudiTrack: string | null
  redirectSlugSeed: string | null
  marketingEntityId: string | null
  generatedAt: string
}

function buildEventDescription(day: CampaignProgramDayRow, program: CampaignProgramRow): string {
  const parts = [
    day.hook.trim(),
    day.vibe.trim(),
    day.directorial_action?.trim(),
    day.phase.trim(),
  ].filter(Boolean)
  const body = parts.join(" · ")
  const prefix = program.brief.trim().slice(0, 120)
  const combined = `${body}. Context: ${prefix}`
  return combined.slice(0, 500)
}

export async function generateDayPackHeadless(input: {
  dayId: string
  entityId: string
  userId: string
}): Promise<{ day: CampaignProgramDayRow; snapshot: ProgramDayPackSnapshot }> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  const { data: day, error: dayError } = await admin
    .from("campaign_program_days")
    .select("*")
    .eq("id", input.dayId)
    .maybeSingle()

  if (dayError) throw new Error(dayError.message)
  if (!day) throw new Error("Program day not found.")

  const { data: program, error: programError } = await admin
    .from("campaign_programs")
    .select("*")
    .eq("id", day.program_id)
    .maybeSingle()

  if (programError) throw new Error(programError.message)
  if (!program || program.entity_id !== input.entityId) {
    throw new Error("Program day does not belong to this entity.")
  }

  if (day.status === "generating") {
    throw new Error("Pack generation already in progress for this day.")
  }

  await admin
    .from("campaign_program_days")
    .update({ status: "generating", last_error: null, updated_at: now })
    .eq("id", input.dayId)

  try {
    const supabase = await createClient()
    const asset = await resolveProgramDayAsset({
      supabase,
      entityId: input.entityId,
      marketingEntityId: day.marketing_entity_id,
    })

    if (!asset) {
      throw new Error(
        "No inventory item with a public image — pull new arrivals or attach media in Studio first."
      )
    }

    const eventDescription = buildEventDescription(
      day as CampaignProgramDayRow,
      program
    )
    if (eventDescription.length < 8) {
      throw new Error("Day hook is too short to generate a pack.")
    }

    const generated = await generateCampaignPackCore({
      supabase,
      userId: input.userId,
      data: {
        entityId: input.entityId,
        eventDescription,
        targetGoal: program.brief.trim().slice(0, 200) || "Drive measurable engagement",
        intent: "Drive Sales",
        attachedImageUrl: asset.mediaUrl,
      },
    })

    const snapshot: ProgramDayPackSnapshot = {
      pack: generated.pack,
      preview: generated.preview,
      campaignId: generated.campaignId,
      intent: generated.intent,
      attachedImageUrl: generated.attachedImageUrl,
      fudiTrack: generated.fudiTrack,
      redirectSlugSeed: generated.redirectSlugSeed,
      marketingEntityId: asset.marketingEntityId,
      generatedAt: now,
    }

    const { data: updated, error: updateError } = await admin
      .from("campaign_program_days")
      .update({
        status: "ready",
        pack_snapshot: snapshot as unknown as Json,
        campaign_id: generated.campaignId,
        marketing_entity_id: asset.marketingEntityId,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.dayId)
      .select("*")
      .single()

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to save pack snapshot.")
    }

    return { day: updated as CampaignProgramDayRow, snapshot }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pack generation failed."
    await admin
      .from("campaign_program_days")
      .update({
        status: "failed",
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.dayId)
    throw error
  }
}
