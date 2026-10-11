import { armDayPosts } from "@/lib/campaigns/arm-program-day"
import { loadCampaignProgramBundle } from "@/lib/campaigns/persist-program-timeline"
import type { CampaignAutonomyMode } from "@/lib/campaigns/program-types"
import { generateDayPackHeadless } from "@/lib/studio/headless-generator"

export type OrchestrateProgramResult = {
  generated: Array<{ dayId: string; status: string; error?: string }>
  armed: Array<{ dayId: string; armed?: number; error?: string }>
}

function shouldArmAfterPack(mode: CampaignAutonomyMode): boolean {
  return mode === "arm" || mode === "full_auto"
}

/**
 * Headless pipeline keyed to program autonomy_mode:
 * - suggest: pack generation only → day status `ready` (operator arms manually)
 * - arm / full_auto: generate packs then arm scheduled_posts (full_auto skips suggest approval)
 */
export async function orchestrateProgramByAutonomy(input: {
  programId: string
  entityId: string
  userId: string
  maxDays?: number
}): Promise<OrchestrateProgramResult> {
  const bundle = await loadCampaignProgramBundle({
    programId: input.programId,
    entityId: input.entityId,
  })
  if (!bundle) {
    throw new Error("Program not found.")
  }

  const limit = input.maxDays ?? 5
  const mode = bundle.program.autonomy_mode

  const toGenerate = bundle.days
    .filter((day) => day.status === "pending" || day.status === "failed")
    .slice(0, limit)

  const generated: OrchestrateProgramResult["generated"] = []

  for (const day of toGenerate) {
    try {
      const result = await generateDayPackHeadless({
        dayId: day.id,
        entityId: input.entityId,
        userId: input.userId,
      })
      generated.push({ dayId: day.id, status: result.day.status })
    } catch (error) {
      generated.push({
        dayId: day.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Generate failed",
      })
    }
  }

  const armed: OrchestrateProgramResult["armed"] = []

  if (!shouldArmAfterPack(mode)) {
    return { generated, armed }
  }

  const refreshed = await loadCampaignProgramBundle({
    programId: input.programId,
    entityId: input.entityId,
  })
  const days = refreshed?.days ?? bundle.days

  for (const day of days.filter((row) => row.status === "ready").slice(0, limit)) {
    if (mode === "suggest" && !day.approved_at) {
      continue
    }
    try {
      const result = await armDayPosts({
        dayId: day.id,
        entityId: input.entityId,
        userId: input.userId,
      })
      armed.push({ dayId: day.id, armed: result.armed })
    } catch (error) {
      armed.push({
        dayId: day.id,
        error: error instanceof Error ? error.message : "Arm failed",
      })
    }
  }

  return { generated, armed }
}
