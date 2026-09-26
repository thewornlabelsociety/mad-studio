import { z } from "zod"

import { mergeIndustryDnaDefaults } from "@/lib/brands/industry-templates"
import {
  audienceSegmentSchema,
  brandIdentitySchema,
} from "@/lib/entities/dna-schema"
import type { Json } from "@/lib/database.types"

const conversionGoalsSchema = z.array(z.string())
const valuePropsSchema = z.record(z.string(), z.string())

export type StudioEntityDna = {
  id: string
  name: string
  industry: string
  organization_id: string
  website_url: string | null
  brand_identity: z.infer<typeof brandIdentitySchema>
  audience_segments: z.infer<typeof audienceSegmentSchema>[]
  value_propositions: Record<string, string>
  conversion_goals: string[]
  content_pillars: string[]
  local_context: string[]
}

function asObject(value: Json | null | undefined): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export function parseStudioEntity(row: {
  id: string
  name: string
  industry: string
  organization_id: string
  website_url: string | null
  brand_identity: Json
  audience_segments: Json
  value_propositions: Json
  conversion_goals: Json
  content_pillars?: Json
  local_context?: Json
}): StudioEntityDna {
  const identityRaw = asObject(row.brand_identity)
  // Support legacy seed shape { tagline, accent } alongside runtime DNA fields.
  const legacyTagline =
    typeof identityRaw.tagline === "string" ? identityRaw.tagline : ""
  const vibesFromIdentity = Array.isArray(identityRaw.vibes)
    ? identityRaw.vibes
    : Array.isArray(identityRaw.vibe_tags)
      ? identityRaw.vibe_tags
      : []
  const identityParsed = brandIdentitySchema.safeParse({
    tone: identityRaw.tone ?? "",
    forbidden_words: Array.isArray(identityRaw.forbidden_words)
      ? identityRaw.forbidden_words
      : [],
    visual_vibe: identityRaw.visual_vibe ?? "",
    core_mission:
      identityRaw.core_mission ?? (legacyTagline ? legacyTagline : ""),
    vibes: vibesFromIdentity,
    tagline:
      typeof identityRaw.tagline === "string"
        ? identityRaw.tagline
        : legacyTagline,
    visual_presets: identityRaw.visual_presets,
  })

  const segmentsRaw = Array.isArray(row.audience_segments)
    ? row.audience_segments
    : []
  const segments = segmentsRaw
    .map((segment) => audienceSegmentSchema.safeParse(segment))
    .filter((result) => result.success)
    .map((result) => result.data)

  const goalsParsed = conversionGoalsSchema.safeParse(row.conversion_goals)
  const propsParsed = valuePropsSchema.safeParse(row.value_propositions)

  const baseIdentity = identityParsed.success
    ? identityParsed.data
    : {
        tone: "",
        forbidden_words: [] as string[],
        visual_vibe: "",
        core_mission: "",
        vibes: [] as string[],
        tagline: "",
      }

  const synced = mergeIndustryDnaDefaults(row.name, row.industry, {
    brand_identity: baseIdentity,
    value_propositions: propsParsed.success ? propsParsed.data : {},
    content_pillars: Array.isArray(row.content_pillars)
      ? (row.content_pillars as string[]).filter((v) => typeof v === "string")
      : [],
    local_context: Array.isArray(row.local_context)
      ? (row.local_context as string[]).filter((v) => typeof v === "string")
      : [],
  })

  return {
    id: row.id,
    name: row.name,
    industry: synced.industry,
    organization_id: row.organization_id,
    website_url: row.website_url,
    brand_identity: synced.brand_identity,
    audience_segments: segments,
    value_propositions: synced.value_propositions,
    conversion_goals: goalsParsed.success ? goalsParsed.data : [],
    content_pillars: synced.content_pillars,
    local_context: synced.local_context,
  }
}
