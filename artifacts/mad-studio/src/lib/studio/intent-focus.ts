import type { IndustryTemplateId } from "@/lib/brands/industry-templates"
import type { AudienceTone } from "@/lib/studio/audience-tone"
import type { StudioIntentChip } from "@/lib/studio/entity-presets"

/** Internal AI target — derived from focus chip + pillar, not a separate UI field. */
const CHIP_OBJECTIVE_BY_PROFILE: Partial<
  Record<IndustryTemplateId, Record<string, string>>
> = {
  worn_label: {
    drive_sales: "Sell through this drop",
    build_hype: "Build anticipation for the brand",
    source_consignment: "Attract new consignors",
    shop_by_vibe: "Promote a Shop by Vibe edit",
  },
  generic: {
    drive_sales: "Drive conversion on this post",
    build_hype: "Build awareness and hype",
  },
}

export function objectiveForIntentChip(
  profileId: IndustryTemplateId,
  chipId: string,
  fallbackLabel: string
): string {
  return (
    CHIP_OBJECTIVE_BY_PROFILE[profileId]?.[chipId] ??
    CHIP_OBJECTIVE_BY_PROFILE.generic?.[chipId] ??
    fallbackLabel
  )
}

/** Single string sent to pack generation — ties tone, focus, and entity topic together. */
export function studioTargetGoal(input: {
  chip: StudioIntentChip
  contentPillar: string
  audienceToneCue: string
  profileId: IndustryTemplateId
}): string {
  const topic =
    input.contentPillar.trim() ||
    objectiveForIntentChip(
      input.profileId,
      input.chip.id,
      input.chip.label
    )
  return `${topic} · ${input.chip.label} — ${input.audienceToneCue}`
}

const PERSONA_HINT_BY_TONE: Record<AudienceTone, RegExp> = {
  gen_z: /gen z|young|rotator|aesthetic|reel/i,
  curated_millennial: /conscious|designer|curated|wardrobe|shopper/i,
  local_community: /local|community|consignor|showroom|neighbour/i,
}

export function personaForAudienceTone<
  T extends { id: string; name: string },
>(tone: AudienceTone, personas: T[]): T | null {
  if (personas.length === 0) return null
  const hint = PERSONA_HINT_BY_TONE[tone]
  return personas.find((row) => hint.test(row.name)) ?? personas[0] ?? null
}
