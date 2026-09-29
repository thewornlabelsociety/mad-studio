import { z } from "zod"

export const audienceSegmentSchema = z.object({
  name: z.string().describe("Segment label, e.g. Local fashion collectors"),
  role: z.string().describe("Who they are in relation to the brand"),
  pain: z
    .string()
    .describe("What drives them crazy right now — acute pain points"),
  desire: z.string().describe("Desired outcome or aspiration"),
  trigger: z
    .string()
    .describe("Life event or moment that makes them buy right now"),
  winning_rebuttal: z
    .string()
    .describe("Their #1 doubt and how the brand solves it"),
  audience_type: z.enum(["b2c", "b2b"]).optional(),
  age_bracket: z.string().optional(),
  primary_feature: z.string().optional(),
  target_channels: z.array(z.string()).optional(),
  forecasting_tag: z.string().optional(),
  conversion_goal: z.string().optional(),
})

export const visualPresetsSchema = z.object({
  canvas_color: z
    .string()
    .describe("Primary background / canvas hex from the brand site"),
  accent_color: z
    .string()
    .describe("Primary accent / CTA hex from the brand site"),
  text_color: z
    .string()
    .describe("Primary body / headline text hex on canvas"),
  font_family: z
    .enum(["serif", "sans", "mono"])
    .or(z.string())
    .describe(
      "Dominant type vibe: serif, sans, mono, or a CSS font-family stack"
    ),
})

export type VisualPresets = z.infer<typeof visualPresetsSchema>

export const brandIdentitySchema = z.object({
  tone: z
    .string()
    .describe("How the brand speaks — Brand Tone & Voice"),
  forbidden_words: z
    .array(z.string())
    .describe("Words to never use — Negative Keywords & Brand Safety"),
  visual_vibe: z.string().describe("Visual atmosphere and aesthetic cues"),
  core_mission: z.string().describe("Why the brand exists"),
  vibes: z
    .array(z.string())
    .optional()
    .default([])
    .describe(
      "Signature collection / vibe labels from the website (e.g. Quiet Luxury, Modern Muse)"
    ),
  tagline: z
    .string()
    .optional()
    .default("")
    .describe("Primary customer-facing tagline from the website"),
  visual_presets: visualPresetsSchema
    .optional()
    .describe(
      "Scraped brand colors + font tokens for Story/Carousel rendering"
    ),
})

export const entityDnaSchema = z.object({
  industry: z.string(),
  business_model: z
    .string()
    .describe('e.g. "B2C Consignment Boutique", "B2B Hospitality Tech"'),
  brand_identity: brandIdentitySchema,
  audience_segments: z.array(audienceSegmentSchema).min(1).max(5),
  value_propositions: z
    .record(z.string(), z.string())
    .describe("Key promise keyed by theme or audience"),
  conversion_goals: z.array(z.string()).min(1),
  content_pillars: z.array(z.string()).min(1),
  local_context: z
    .array(z.string())
    .describe("Seasonal patterns and local market quirks"),
})

export type AudienceSegment = z.infer<typeof audienceSegmentSchema>
export type BrandIdentity = z.infer<typeof brandIdentitySchema>
export type EntityDna = z.infer<typeof entityDnaSchema>

export const scrapeRequestSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1).max(500),
})

export const socialChannelsSchema = z.object({
  instagram: z.string().optional().default(""),
  tiktok: z.string().optional().default(""),
  facebook: z.string().optional().default(""),
  linkedin: z.string().optional().default(""),
})

export type SocialChannels = z.infer<typeof socialChannelsSchema>

export const SOCIAL_PLATFORMS = [
  "instagram",
  "tiktok",
  "facebook",
  "linkedin",
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export function emptyDna(name: string): EntityDna {
  return {
    industry: "",
    business_model: "",
    brand_identity: {
      tone: "",
      forbidden_words: [],
      visual_vibe: "",
      core_mission: `${name} brand mission`,
      vibes: [],
      tagline: "",
    },
    audience_segments: [
      {
        name: "Primary buyers",
        role: "Core customer",
        pain: "",
        desire: "",
        trigger: "",
        winning_rebuttal: "",
      },
    ],
    value_propositions: {},
    conversion_goals: [],
    content_pillars: [],
    local_context: [],
  }
}

export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Website URL is required.")
  }
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  let parsed: URL
  try {
    parsed = new URL(withProtocol)
  } catch {
    throw new Error("Enter a valid website URL.")
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.")
  }
  parsed.hash = ""
  return parsed.toString()
}
