import { z } from "zod"

/** Instagram Feed 4:5 — matches typical Canva “post” export. */
export const FRAME_TEMPLATE_ASPECTS = ["1:1", "4:5", "9:16"] as const
export type FrameTemplateAspect = (typeof FRAME_TEMPLATE_ASPECTS)[number]

export const frameImageSlotSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  /** Percent of canvas (0–100). */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  w: z.number().min(1).max(100),
  h: z.number().min(1).max(100),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** Optional corner radius as % of the shorter slot side. */
  radiusPct: z.number().min(0).max(50).optional(),
})

export type FrameImageSlot = z.infer<typeof frameImageSlotSchema>

export const frameTextSlotSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(80),
  defaultText: z.string().max(200).default(""),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  /** Max text box width as % of canvas width. */
  maxWidthPct: z.number().min(5).max(100).default(40),
  fontScale: z.number().min(0.4).max(4).default(1.1),
  color: z.string().max(32).default("#E8D7B8"),
  align: z.enum(["left", "center", "right"]).default("left"),
  /** Solid patch behind text to cover baked Canva copy when needed. */
  coverBg: z.string().max(32).optional().nullable(),
})

export type FrameTextSlot = z.infer<typeof frameTextSlotSchema>

export const frameTemplateSchema = z.object({
  version: z.literal(1).default(1),
  canvas: z.object({
    width: z.number().int().positive().default(1080),
    height: z.number().int().positive().default(1350),
    aspect: z.enum(FRAME_TEMPLATE_ASPECTS).default("4:5"),
  }),
  /** Public entity-assets URL for the Canva export (chrome + empty frames). */
  backgroundUrl: z.string().url().or(z.literal("")).default(""),
  imageSlots: z.array(frameImageSlotSchema).max(12).default([]),
  textSlots: z.array(frameTextSlotSchema).max(12).default([]),
})

export type FrameTemplate = z.infer<typeof frameTemplateSchema>

export function parseFrameTemplate(raw: unknown): FrameTemplate | null {
  const parsed = frameTemplateSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function hasUsableFrameTemplate(
  value: FrameTemplate | null | undefined
): value is FrameTemplate {
  return Boolean(value?.backgroundUrl?.trim() && value.imageSlots.length > 0)
}

/**
 * Slot geometry tuned to the Worn Label “Outfit Add-On Frames” Canva board
 * (Instagram Feed OOTD). Fine-tune in Template Centre after upload.
 */
export function createInstagramFeedOotdPreset(
  backgroundUrl = ""
): FrameTemplate {
  return frameTemplateSchema.parse({
    version: 1,
    canvas: { width: 1080, height: 1350, aspect: "4:5" },
    backgroundUrl,
    imageSlots: [
      {
        id: "hero",
        label: "Main outfit",
        x: 5.5,
        y: 14.5,
        w: 52,
        h: 58,
        fit: "cover",
        radiusPct: 2,
      },
      {
        id: "item_1",
        label: "Item 1",
        x: 62,
        y: 16.5,
        w: 30,
        h: 16.5,
        fit: "cover",
        radiusPct: 2,
      },
      {
        id: "item_2",
        label: "Item 2",
        x: 62,
        y: 39.5,
        w: 30,
        h: 16.5,
        fit: "cover",
        radiusPct: 2,
      },
      {
        id: "item_3",
        label: "Item 3",
        x: 62,
        y: 62.5,
        w: 30,
        h: 16.5,
        fit: "cover",
        radiusPct: 2,
      },
    ],
    textSlots: [
      {
        id: "headline",
        label: "Headline",
        defaultText: "OOTD VIBES",
        x: 8,
        y: 8.5,
        maxWidthPct: 55,
        fontScale: 1.55,
        color: "#E8D7B8",
        align: "left",
        coverBg: "#0A0A0A",
      },
      {
        id: "label_1",
        label: "Item 1 label",
        defaultText: "THE SHIRT",
        x: 62,
        y: 13.2,
        maxWidthPct: 32,
        fontScale: 0.72,
        color: "#E8D7B8",
        align: "left",
        coverBg: "#0A0A0A",
      },
      {
        id: "label_2",
        label: "Item 2 label",
        defaultText: "THE TEE / TOP",
        x: 62,
        y: 36.2,
        maxWidthPct: 32,
        fontScale: 0.72,
        color: "#E8D7B8",
        align: "left",
        coverBg: "#0A0A0A",
      },
      {
        id: "label_3",
        label: "Item 3 label",
        defaultText: "THE SKIRT",
        x: 62,
        y: 59.2,
        maxWidthPct: 32,
        fontScale: 0.72,
        color: "#E8D7B8",
        align: "left",
        coverBg: "#0A0A0A",
      },
    ],
  })
}

export function defaultTextFillsFromTemplate(
  template: FrameTemplate
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slot of template.textSlots) {
    out[slot.id] = slot.defaultText ?? ""
  }
  return out
}

export const FRAME_TEMPLATE_MIME_URL = "text/mad-media-url"
export const FRAME_TEMPLATE_MIME_ASSET = "text/mad-media-asset"
