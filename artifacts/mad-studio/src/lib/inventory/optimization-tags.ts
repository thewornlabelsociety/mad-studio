import type { MarketingEntity } from "@/lib/inventory/types"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"

/** Normalize to Instagram/TikTok-friendly tag tokens (no #). */
export function normalizeOptTag(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9āēīōū]+/gi, "")
  if (cleaned.length < 2 || cleaned.length > 40) return null
  return cleaned
}

function pushTag(out: string[], ...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) continue
    const tag = normalizeOptTag(candidate)
    if (!tag || out.includes(tag)) continue
    out.push(tag)
  }
}

/**
 * Search / discovery tags grounded in the listing — brand, vibe, garment, place.
 * Tuned for IG/TikTok search + SEO caption footers.
 */
export function buildOptimizationTags(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
  listingVibe?: string | null
}): string[] {
  const tags: string[] = []
  const isFudi = isFudiStudioEntity({
    name: input.brandName,
    industry: input.industry,
  })
  const designer = input.item.brand?.trim() || null
  const vibe = input.listingVibe?.trim() || input.item.vibe?.trim() || null
  const hay = `${input.item.title} ${input.item.description ?? ""}`

  if (isFudi) {
    pushTag(
      tags,
      "fudi",
      "whangarei",
      "whangareieats",
      "nzfood",
      "northlandeats",
      "supportlocal"
    )
    return tags.slice(0, 12)
  }

  pushTag(
    tags,
    "wornlabelsociety",
    "whangarei",
    "preloved",
    "consignment",
    "nzfashion",
    designer,
    vibe,
    hay.match(
      /\b(maxi|midi|mini|skirt|dress|blazer|coat|jean|denim|linen|silk|cotton|wool|cashmere)\b/i
    )?.[1],
    hay.match(
      /\b(green|black|white|cream|navy|beige|pink|blue|brown|olive)\b/i
    )?.[1],
    "shopwhangarei",
    "sustainablefashion",
    "secondhandstyle",
    "newarrival"
  )

  // Slug-derived vibe tags from the listing
  for (const slug of input.item.aesthetic_slugs.slice(0, 3)) {
    pushTag(tags, slug.replace(/-/g, ""))
  }

  return tags.slice(0, 12)
}

export function formatTagsForCaption(tags: string[]): string {
  const cleaned = tags
    .map((tag) => normalizeOptTag(tag))
    .filter((tag): tag is string => Boolean(tag))
  if (cleaned.length === 0) return ""
  return cleaned.map((tag) => `#${tag}`).join(" ")
}

export function mergeCaptionWithTags(
  caption: string,
  tags: string[] | null | undefined
): string {
  const body = caption.trim()
  const tagLine = formatTagsForCaption(tags ?? [])
  if (!tagLine) return body
  if (!body) return tagLine
  if (/#[a-z0-9]/i.test(body) && tags?.every((t) => body.toLowerCase().includes(t.toLowerCase()))) {
    return body
  }
  return `${body}\n\n${tagLine}`
}
