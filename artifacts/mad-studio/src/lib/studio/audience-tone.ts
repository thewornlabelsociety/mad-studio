export const AUDIENCE_TONES = [
  "gen_z",
  "curated_millennial",
  "local_community",
] as const

export type AudienceTone = (typeof AUDIENCE_TONES)[number]

export const AUDIENCE_TONE_META: Record<
  AudienceTone,
  { label: string; short: string; promptCue: string }
> = {
  gen_z: {
    label: "Gen Z / Young Millennial (18–27)",
    short: "Gen Z",
    promptCue:
      "Fast hook, aesthetic, direct, casual, Reel-first — no corporate jargon.",
  },
  curated_millennial: {
    label: "Curated Millennial (28–42)",
    short: "Curated",
    promptCue: "Editorial tone, aesthetic appreciation, clean consumer copy.",
  },
  local_community: {
    label: "Local Community (40+)",
    short: "Local",
    promptCue:
      "Warm, community-oriented, clear times and details, Facebook-friendly.",
  },
}

/** Brand-specific wording for a tone (shown on Intent and sent to the AI). */
const TONE_CUE_BY_PROFILE: Partial<
  Record<string, Partial<Record<AudienceTone, string>>>
> = {
  worn_label: {
    curated_millennial:
      "Editorial tone, appreciation for fabric, fit and provenance, clean consumer copy.",
  },
  fudi: {
    curated_millennial:
      "Editorial tone, culinary and aesthetic appreciation, clean consumer copy.",
  },
}

export function audienceToneCue(
  tone: AudienceTone,
  profileId?: string | null
): string {
  return (
    (profileId && TONE_CUE_BY_PROFILE[profileId]?.[tone]) ||
    AUDIENCE_TONE_META[tone].promptCue
  )
}

export function isAudienceTone(value: unknown): value is AudienceTone {
  return (
    typeof value === "string" &&
    (AUDIENCE_TONES as readonly string[]).includes(value)
  )
}
