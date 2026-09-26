import {
  resolveIndustryProfile,
  type IndustryTemplateId,
} from "@/lib/brands/industry-templates"

export type InventoryIntakeMode = "website" | "food_feed"

export function resolveInventoryIntakeMode(input: {
  name?: string | null
  industry?: string | null
}): InventoryIntakeMode {
  const profile = resolveIndustryProfile(input)
  if (profile.id === "fudi") return "food_feed"
  const industry = (input.industry ?? "").toLowerCase()
  if (
    /food|beverage|hospitality|eatery|restaurant|cafe|dining/.test(industry)
  ) {
    return "food_feed"
  }
  return "website"
}

export function inventoryIntakeLabel(mode: InventoryIntakeMode): string {
  return mode === "food_feed"
    ? "⟳ Pull New Arrivals / Feed"
    : "⟳ Pull New Arrivals / Feed"
}

export function inventoryIntakeBusyLabel(mode: InventoryIntakeMode): string {
  return mode === "food_feed"
    ? "Fetching eatery feed…"
    : "Fetching latest drops…"
}

export function inventoryProfileId(input: {
  name?: string | null
  industry?: string | null
}): IndustryTemplateId {
  return resolveIndustryProfile(input).id
}

/** Fashion catalog rows wrongly attributed to a food tenant (legacy cross-feed). */
export function looksLikeFashionCatalogContamination(item: {
  title?: string | null
  brand?: string | null
  website_item_id?: string | null
  description?: string | null
}): boolean {
  const hay = [
    item.title,
    item.brand,
    item.website_item_id,
    item.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (/^(ig-|fudi-|demo-fudi)/i.test(item.website_item_id ?? "")) {
    return false
  }

  return (
    /\b(zara|zimmermann|maxi skirt|worn label|linen midi)\b/i.test(hay) ||
    /\b(size:\s*[xsml0-9]|cotton\s*-\s*[xsml0-9]|sample size)\b/i.test(hay)
  )
}
