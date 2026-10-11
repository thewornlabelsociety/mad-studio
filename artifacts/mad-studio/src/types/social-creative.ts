import { z } from "zod"

export type EntityType = "WORN_LABEL" | "FUDI"

export type AspectRatio = "1:1" | "9:16"

export type WornLabelTagColorName =
  | "PURPLE"
  | "ORANGE"
  | "BLACK"
  | "PINK"
  | "GREEN"
  | "RED"
  | "BLUE"
  | "YELLOW"

export type DateStyle = "gold_pill" | "stamp" | "ribbon" | "minimal"

export type MotionStyle = "pulse" | "sheen" | "pop" | "subtle"

export const wornLabelCampaignConfigSchema = z.object({
  entityType: z.literal("WORN_LABEL"),
  aspectRatio: z.enum(["1:1", "9:16"]),
  colorName: z.enum([
    "PURPLE",
    "ORANGE",
    "BLACK",
    "PINK",
    "GREEN",
    "RED",
    "BLUE",
    "YELLOW",
  ]),
  colorHex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  discountText: z.string().min(1),
  headline: z.string().min(1),
  eyebrow: z.string().default("SHOP PRE-LOVED FASHION BY VIBE"),
  dateLabel: z.string().min(1),
  dateStyle: z.enum(["gold_pill", "stamp", "ribbon", "minimal"]),
  storeNotice: z.string().default("IN-STORE & ONLINE • WHANGĀREI BOUTIQUE"),
  motionStyle: z.enum(["pulse", "sheen", "pop", "subtle"]).default("pulse"),
})

export type WornLabelCampaignConfig = z.infer<
  typeof wornLabelCampaignConfigSchema
>

export const fudiCampaignConfigSchema = z.object({
  entityType: z.literal("FUDI"),
  aspectRatio: z.enum(["1:1", "9:16"]),
  dealType: z.enum(["HAPPY_HOUR", "LUNCH_SPECIAL", "COMBO", "FLASH_DEAL"]),
  dealHeadline: z.string().min(1),
  subHeadline: z.string().optional(),
  validityWindow: z.string().min(1),
  venueName: z.string().min(1),
  venueLocation: z.string().optional(),
  perks: z.array(z.string()).default([]),
  ctaText: z.string().default("CLAIM IN THE FÜDI APP"),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  motionStyle: z
    .enum(["pulse", "badge_bounce", "slide_up", "subtle"])
    .default("pulse"),
})

export type FudiCampaignConfig = z.infer<typeof fudiCampaignConfigSchema>

export const campaignConfigSchema = z.discriminatedUnion("entityType", [
  wornLabelCampaignConfigSchema,
  fudiCampaignConfigSchema,
])

export type CampaignConfig = z.infer<typeof campaignConfigSchema>
