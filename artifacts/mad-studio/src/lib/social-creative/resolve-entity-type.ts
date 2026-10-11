import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import type {
  AspectRatio,
  EntityType,
  WornLabelCampaignConfig,
  WornLabelTagColorName,
} from "@/types/social-creative"
import { wornLabelCampaignConfigSchema } from "@/types/social-creative"

import { WORN_LABEL_TAG_COLORS } from "./worn-label-promo-theme"

export function resolveEntityType(input?: {
  name?: string | null
  industry?: string | null
  entityId?: string | null
}): EntityType {
  if (input?.entityId === FUDI_ENTITY_ID) {
    return "FUDI"
  }
  const profile = resolveIndustryProfile({
    name: input?.name ?? undefined,
    industry: input?.industry ?? undefined,
  })
  if (profile.id === "worn_label") return "WORN_LABEL"
  return "FUDI"
}

export function defaultWornLabelDotSpecialConfig(
  aspectRatio: AspectRatio = "9:16",
  colorName: WornLabelTagColorName = "PURPLE"
): WornLabelCampaignConfig {
  return wornLabelCampaignConfigSchema.parse({
    entityType: "WORN_LABEL",
    aspectRatio,
    colorName,
    colorHex: WORN_LABEL_TAG_COLORS[colorName].hex,
    discountText: "50% OFF",
    headline: "BECAUSE THE BEST WARDROBES AREN'T NEW",
    eyebrow: "SHOP PRE-LOVED FASHION BY VIBE",
    dateLabel: "⚡ THIS WEEKEND ONLY",
    dateStyle: "gold_pill",
    storeNotice: "IN-STORE & ONLINE • WHANGĀREI BOUTIQUE",
    motionStyle: "pulse",
  })
}
