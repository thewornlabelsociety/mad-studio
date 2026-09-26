import { z } from "zod"

export const campaignPackSchema = z.object({
  campaign_title: z.string(),
  creative_hooks: z
    .object({
      vibe_styling: z
        .string()
        .describe(
          "Vibe / styling angle hook — how to wear or style THIS piece, client voice only"
        ),
      investment_condition: z
        .string()
        .describe(
          "Investment & condition angle — quality, provenance, value vs retail, client voice"
        ),
      local_instore: z
        .string()
        .describe(
          "Local / in-store angle — Whangārei showroom arrival or try-on invite, client voice"
        ),
    })
    .optional()
    .describe(
      "Always populate — three distinct click-to-apply hooks for THIS garment/media"
    ),
  algorithmic_signals: z.object({
    spoken_hook: z
      .string()
      .describe(
        "0–3s spoken audio hook naming the exact identifier and acute desire"
      ),
    on_screen_text: z
      .string()
      .describe("Bold 3–5 word visual overlay for OCR scrapers"),
    search_keywords: z
      .array(z.string())
      .min(3)
      .max(5)
      .describe("Natural phrases people type into TikTok/Instagram search"),
  }),
  short_video_script: z.object({
    hook_visual: z.string(),
    spoken_lines: z.array(z.string()).min(2),
    b_roll_cues: z.array(z.string()).min(1),
    cta_spoken: z.string(),
  }),
  carousel: z.object({
    title: z.string(),
    slides: z
      .array(
        z.object({
          slide_number: z.number().int().positive(),
          headline: z.string(),
          body_text: z.string(),
        })
      )
      .min(3)
      .max(8),
  }),
  seo_caption: z.object({
    caption_body: z.string(),
    search_optimized_tags: z.array(z.string()).min(3),
  }),
  email_drop: z.object({
    subject_line: z.string(),
    preview_text: z.string(),
    body_markdown: z.string(),
  }),
  b2b_dm: z.object({
    platform: z.string(),
    message_text: z.string(),
  }),
})

export type CampaignPack = z.infer<typeof campaignPackSchema>

export const generatePackRequestSchema = z.object({
  entityId: z.string().uuid(),
  eventDescription: z.string().min(8).max(500),
  targetGoal: z.string().min(1).max(200),
  personaName: z.string().max(200).optional().nullable(),
  intent: z
    .enum(["Drive Sales", "Build Hype", "Get Inventory", "Teach AI"])
    .optional()
    .nullable(),
  attachedImageUrl: z.string().max(2000).optional().nullable(),
  fudiTrack: z.enum(["diners", "partners"]).optional().nullable(),
  visualDescription: z.string().max(4000).optional().nullable(),
  concreteFeatures: z.array(z.string().max(200)).max(20).optional().nullable(),
  aestheticTags: z.array(z.string().max(80)).max(12).optional().nullable(),
})

export type GeneratePackRequest = z.infer<typeof generatePackRequestSchema>

export function packToAssetPack(pack: CampaignPack) {
  return {
    short_video: pack.short_video_script,
    carousel: pack.carousel,
    seo_caption: pack.seo_caption,
    email_drop: pack.email_drop,
    b2b_dm: pack.b2b_dm,
  }
}

function padStrings(values: string[], min: number, fallback: string): string[] {
  const cleaned = values.map((value) => value.trim()).filter(Boolean)
  if (cleaned.length >= min) return cleaned
  const padded = [...cleaned]
  while (padded.length < min) padded.push(fallback)
  return padded
}

/** Keeps edited packs persistable when operators trim arrays below schema mins. */
export function normalizePackForPersistence(pack: CampaignPack): CampaignPack {
  return {
    ...pack,
    campaign_title: pack.campaign_title.trim() || "Untitled campaign",
    algorithmic_signals: {
      ...pack.algorithmic_signals,
      spoken_hook: pack.algorithmic_signals.spoken_hook.trim(),
      on_screen_text: pack.algorithmic_signals.on_screen_text.trim(),
      search_keywords: padStrings(
        pack.algorithmic_signals.search_keywords,
        3,
        "fashion"
      ).slice(0, 5),
    },
    short_video_script: {
      ...pack.short_video_script,
      spoken_lines: padStrings(pack.short_video_script.spoken_lines, 2, "…"),
      b_roll_cues: padStrings(pack.short_video_script.b_roll_cues, 1, "Detail shot"),
    },
    carousel: {
      ...pack.carousel,
      slides:
        pack.carousel.slides.length >= 3
          ? pack.carousel.slides
          : [
              ...pack.carousel.slides,
              ...Array.from(
                { length: Math.max(0, 3 - pack.carousel.slides.length) },
                (_, index) => ({
                  slide_number: pack.carousel.slides.length + index + 1,
                  headline: "Slide",
                  body_text: "",
                })
              ),
            ],
    },
    seo_caption: {
      ...pack.seo_caption,
      search_optimized_tags: padStrings(
        pack.seo_caption.search_optimized_tags,
        3,
        "style"
      ),
    },
  }
}

export function packToCleanText(pack: CampaignPack, tab: string): string {
  switch (tab) {
    case "video":
      return [
        pack.algorithmic_signals.spoken_hook,
        pack.algorithmic_signals.on_screen_text,
        ...pack.short_video_script.spoken_lines,
        pack.short_video_script.cta_spoken,
      ]
        .filter(Boolean)
        .join("\n\n")
    case "carousel":
      return pack.carousel.slides
        .map(
          (slide) =>
            `Slide ${slide.slide_number}: ${slide.headline}\n${slide.body_text}`
        )
        .join("\n\n")
    case "caption":
      return [
        pack.seo_caption.caption_body,
        pack.seo_caption.search_optimized_tags.join(" "),
      ].join("\n\n")
    case "email":
      return [
        pack.email_drop.subject_line,
        pack.email_drop.preview_text,
        stripMarkdown(pack.email_drop.body_markdown),
      ].join("\n\n")
    case "dm":
      return pack.b2b_dm.message_text
    default:
      return pack.campaign_title
  }
}

export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```\w*\n?/g, "").replace(/```/g, "")
    )
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
