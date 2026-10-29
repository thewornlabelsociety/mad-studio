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

/** One Story background: a named ground with its own fixed text and accent colours. */
export const storyBackgroundSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(40),
  color: z.string(),
  text_color: z.string(),
  accent_color: z.string(),
  /** Item traits this ground suits (STORY_ITEM_TRAITS ids), used to auto-pick. */
  suits: z.array(z.string().max(32)).max(12).optional(),
})

export type StoryBackground = z.infer<typeof storyBackgroundSchema>

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
  /** This brand's own logo (not MAD Studio's), stamped on story graphics. */
  logo_url: z.string().optional(),
  logo_corner: z
    .enum(["top_left", "top_right", "bottom_left", "bottom_right"])
    .optional(),
  /** Brand colours offered for on-image text and story backgrounds. */
  palette: z.array(z.string()).max(12).optional(),
  /** Default on-image headline font (a CANVAS_TEXT_FONTS id). */
  heading_font_id: z.string().optional(),
  /** Up to five Story backgrounds; new-arrival Stories pick one per item. */
  story_kit: z.array(storyBackgroundSchema).max(5).optional(),
})

export type LogoCorner = NonNullable<VisualPresets["logo_corner"]>

/** A saved Canvas layout: on-image styling and placement, reused per post. */
export const canvasLayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  isDefault: z.boolean().optional(),
  overlay: z.record(z.string(), z.unknown()),
  createdAt: z.string().optional(),
})

export type SavedCanvasLayout = z.infer<typeof canvasLayoutSchema>

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
  /** Saved Canvas layouts — set in Studio, never by website scraping. */
  canvas_layouts: z.array(canvasLayoutSchema).optional(),
  /** Default caption when website sync creates a new marketing_entities row. */
  intake_caption_default: z
    .enum(["title", "listing_description"])
    .optional(),
  formula_bank: z
    .object({
      hook_styles: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          template: z.string(),
          weight: z.number().positive().optional(),
          success_count: z.number().int().nonnegative().optional(),
          failure_count: z.number().int().nonnegative().optional(),
        })
      ),
      visual_directions: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          cue: z.string(),
        })
      ),
    })
    .optional()
    .describe("Pre-seeded hook/visual formulas for zero-token Studio renders"),
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
