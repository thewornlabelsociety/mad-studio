import { z } from "zod"

export const mediaVisualInspectionSchema = z.object({
  visualDescription: z
    .string()
    .describe(
      "2–4 dense sentences describing only what is visibly present in the media — fabric/cut/color/hardware or ingredients/plating/texture/ambiance. No marketing fluff."
    ),
  aestheticTags: z
    .array(z.string())
    .min(1)
    .max(6)
    .describe(
      "Short aesthetic labels grounded in the frame, e.g. Quiet Luxury, Street Archive, Rustic Comfort Food"
    ),
  concreteFeatures: z
    .array(z.string())
    .min(3)
    .max(12)
    .describe(
      "Bullet-ready concrete visual features the camera shows (ribbed knit, bias cut, glazed bao, steaming broth, etc.)"
    ),
})

export type MediaVisualInspection = z.infer<typeof mediaVisualInspectionSchema>

export const mediaInspectRequestSchema = z.object({
  mediaUrl: z.string().min(1).max(8000),
  mediaType: z.enum(["image", "video"]).optional().default("image"),
  entityId: z.string().uuid(),
  /** Optional JPEG/PNG data URL of a sampled video keyframe. */
  frameDataUrl: z.string().max(6_000_000).optional().nullable(),
})

export type MediaInspectRequest = z.infer<typeof mediaInspectRequestSchema>

export function buildMediaInspectPrompt(input: {
  mediaType: "image" | "video"
  brandHint?: string | null
}): string {
  return [
    `You are a visual merchandising inspector for a marketing studio.`,
    `Analyze the attached ${input.mediaType === "video" ? "video keyframe" : "product / dish photo"}.`,
    input.brandHint ? `Brand context (voice only — do not invent unseen props): ${input.brandHint}` : "",
    ``,
    `Extract ONLY what is physically visible. Never invent logos, prices, or off-camera props.`,
    ``,
    `Cover when present:`,
    `- Garment / product: fabric texture (ribbed knit, liquid silk, raw denim…), silhouette/cut (bias-cut, boxy crop, drop-shoulder…), color tones, hardware, styling details.`,
    `- Food / dish: main ingredients visible, plating style, textures (crispy, glazed, steaming), ambiance cues.`,
    `- Overall aesthetic tag grounded in the frame (Quiet Luxury, Street Archive, Rustic Comfort Food, etc.).`,
    ``,
    `Return structured JSON matching the schema. Be specific and sensory — no generic marketing clichés.`,
  ]
    .filter(Boolean)
    .join("\n")
}
