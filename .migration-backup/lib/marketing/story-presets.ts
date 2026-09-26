import { pickDefaultVibeTag, resolveIndustryProfile } from "@/lib/brands/industry-templates"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"

export const STORY_STYLE_PRESETS = [
  "moody_noir",
  "magazine_editorial",
] as const

export type StoryStylePreset = (typeof STORY_STYLE_PRESETS)[number]

export const STORY_STYLE_OPTIONS: Array<{
  id: StoryStylePreset
  label: string
  description: string
}> = [
  {
    id: "moody_noir",
    label: "Clean",
    description: "Deep canvas, cutout subject, brand · category · size",
  },
  {
    id: "magazine_editorial",
    label: "Editorial",
    description: "Asymmetric magazine split with typography panel",
  },
]

export const STORY_FORMATS = [
  "story_9_16",
  "feed_4_5",
  "square_1_1",
  "newsletter_16_9",
] as const

export type StoryFormat = (typeof STORY_FORMATS)[number]

export const STORY_FORMAT_OPTIONS: Array<{
  id: StoryFormat
  label: string
  aspectClass: string
  ratioLabel: string
  exportWidth: number
  exportHeight: number
}> = [
  {
    id: "story_9_16",
    label: "9:16 Vertical Story",
    aspectClass: "aspect-[9/16]",
    ratioLabel: "9:16",
    exportWidth: 1080,
    exportHeight: 1920,
  },
  {
    id: "feed_4_5",
    label: "4:5 Feed Portrait",
    aspectClass: "aspect-[4/5]",
    ratioLabel: "4:5",
    exportWidth: 1080,
    exportHeight: 1350,
  },
  {
    id: "square_1_1",
    label: "1:1 Square Feed",
    aspectClass: "aspect-square",
    ratioLabel: "1:1",
    exportWidth: 1080,
    exportHeight: 1080,
  },
  {
    id: "newsletter_16_9",
    label: "16:9 Newsletter Hero",
    aspectClass: "aspect-video",
    ratioLabel: "16:9",
    exportWidth: 1600,
    exportHeight: 900,
  },
]

export const CANVAS_BG_PRESETS = [
  { id: "warm_stone", label: "Warm Stone", hex: "#F9F8F6" },
  { id: "pure_paper", label: "Pure Paper", hex: "#FFFFFF" },
  { id: "soft_cream", label: "Soft Cream", hex: "#F6F3EE" },
  { id: "moody_obsidian", label: "Moody Obsidian", hex: "#121211" },
  { id: "sage_olive", label: "Sage Olive", hex: "#2A2E27" },
  { id: "espresso", label: "Espresso", hex: "#201C1B" },
] as const

export type CanvasBgPresetId = (typeof CANVAS_BG_PRESETS)[number]["id"] | "custom"

export type StoryCanvasModel = {
  brandName: string
  title: string
  headline: string
  category: string
  designer: string
  priceLabel: string
  sizeLabel: string | null
  colorLabel: string | null
  /** Short garment / product name for story captions (no brand/size noise). */
  productLabel: string
  vibeTag: string | null
  provenance: string | null
  stickerLabel: string
  footerLine: string
  /** Specs line e.g. MARNI // SILK SHIRT // SZ 40 */
  specsLine: string
  imageUrl: string | null
}

export function buildStoryCanvasModel(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  headline?: string
  imageUrl?: string | null
}): StoryCanvasModel {
  const profile = resolveIndustryProfile({
    name: input.brandName,
    industry: input.industry,
  })
  const priceLabel = formatInventoryPrice(input.item.price)
  const sizeLabel = extractSizeLabel(input.item)
  const vibeTag = pickDefaultVibeTag(
    profile,
    `${input.item.title} ${input.item.description ?? ""} ${input.headline ?? ""}`
  )
  const designer = input.item.brand?.trim() || input.brandName
  const category =
    vibeTag ||
    profile.contentPillars[0] ||
    input.item.brand ||
    "New Arrival"
  const provenance = extractProvenance(input.item)
  const fabric = extractFabric(input.item)
  const colorLabel = extractColourLabel(input.item)
  const productLabel = conciseProductLabel(
    input.headline?.trim() || input.item.title,
    designer
  )
  const titleShort = (input.headline?.trim() || input.item.title)
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()

  const specsParts = [
    designer.toUpperCase(),
    fabric ? fabric.toUpperCase() : titleShort.slice(0, 28),
    sizeLabel ? `SZ ${sizeLabel}` : null,
    priceLabel !== "—" ? priceLabel : null,
  ].filter(Boolean)

  return {
    brandName: input.brandName,
    title: input.item.title,
    headline: input.headline?.trim() || input.item.title,
    category,
    designer,
    priceLabel,
    sizeLabel,
    colorLabel,
    productLabel,
    vibeTag,
    provenance,
    stickerLabel:
      profile.id === "worn_label"
        ? "SHOP THE LOOK"
        : profile.shopLinkLabel.toUpperCase() || "SHOP THE LOOK",
    footerLine:
      profile.locationFooter ||
      `IN STORE AT ${input.brandName.toUpperCase()} // ONLINE`,
    specsLine: specsParts.join(" // "),
    imageUrl: input.imageUrl ?? input.item.images[0] ?? null,
  }
}

export function resolveItemDestinationUrl(input: {
  websiteUrl?: string | null
  websiteItemId?: string | null
}): string | null {
  if (!input.websiteUrl?.trim()) return null
  try {
    const base = new URL(
      /^https?:\/\//i.test(input.websiteUrl)
        ? input.websiteUrl
        : `https://${input.websiteUrl}`
    )
    if (base.hostname === "wornlabelsociety.co.nz") {
      base.hostname = "www.wornlabelsociety.co.nz"
    }
    const itemId = input.websiteItemId?.trim()
    if (itemId) {
      return `${base.origin}/marketplace/listings/${encodeURIComponent(itemId)}`
    }
    return `${base.origin}/`
  } catch {
    return null
  }
}

export function isDarkCanvas(hex: string): boolean {
  const normalized = hex.replace("#", "")
  if (normalized.length < 6) return false
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  // Relative luminance approximation
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luma < 0.45
}

function extractSizeLabel(item: MarketingEntity): string | null {
  const haystack = `${item.title} ${item.description ?? ""}`
  const labeled = haystack.match(/\bSize[:\s]*([A-Za-z0-9./\-]+)/i)
  if (labeled?.[1]) return labeled[1].toUpperCase()
  const bare = haystack.match(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\b/i)
  return bare?.[1] ? bare[1].toUpperCase() : null
}

function extractFabric(item: MarketingEntity): string | null {
  const description = item.description?.trim()
  if (!description) return null
  const fabric = description.match(
    /\b(silk|linen|wool|cashmere|cotton|leather|denim|chiffon|tweed|satin|velvet)\b/i
  )
  return fabric?.[1] ?? null
}

function extractColourLabel(item: MarketingEntity): string | null {
  const haystack = `${item.title} ${item.description ?? ""}`
  const labeled = haystack.match(
    /\b(?:colou?r|shade|tone)[:\s]+([A-Za-z][A-Za-z\s/-]{1,24})/i
  )
  if (labeled?.[1]) {
    return labeled[1].trim().replace(/\s+/g, " ")
  }

  const named = haystack.match(
    /\b(black|white|ivory|cream|beige|taupe|grey|gray|charcoal|navy|blue|cobalt|teal|green|olive|sage|emerald|brown|tan|camel|rust|terracotta|orange|yellow|gold|mustard|red|burgundy|wine|pink|blush|rose|purple|lilac|lavender|silver|metallic|multicolou?r|multi)\b/i
  )
  if (!named?.[1]) return null
  const word = named[1].toLowerCase()
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function extractProvenance(item: MarketingEntity): string | null {
  const description = item.description?.trim()
  if (!description) return null
  const fabric = extractFabric(item)
  const parts: string[] = []
  if (item.brand) parts.push(item.brand)
  if (fabric) parts.push(fabric.toLowerCase())
  if (item.price != null) {
    parts.push(`RRP context ${formatInventoryPrice(item.price)}`)
  }
  return parts.length > 0 ? parts.join(" · ") : description.slice(0, 90)
}

/** Strip catalog noise so story captions stay short (no repeated brand/size/fabric). */
export function conciseProductLabel(
  raw: string,
  brand?: string | null
): string {
  const fallback = raw.split(/[-–—|]/)[0]?.trim() || raw.trim()
  let text = raw.replace(/\s+/g, " ").trim()

  if (brand?.trim()) {
    const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ")
  }

  text = text
    .replace(/\btest\s*item\b/gi, " ")
    .replace(/\bsize[:\s]*[A-Za-z0-9./\-]+/gi, " ")
    .replace(/\b(XXS|XS|S|M|L|XL|XXL|2XL|3XL)\b/gi, " ")
    .replace(
      /\b(silk|linen|wool|cashmere|cotton|leather|denim|chiffon|tweed|satin|velvet|polyester|viscose|nylon)\b/gi,
      " "
    )
    .replace(/\$?\d+(?:\.\d{2})?/g, " ")
    .replace(/\s*[-–—|/,:]+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (!text || text.length < 2) text = fallback
  if (text.length > 36) text = `${text.slice(0, 34).trim()}…`
  return text
}
