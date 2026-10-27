import {
  buildOptimizationTags,
  normalizeOptTag,
} from "@/lib/inventory/optimization-tags"
import {
  isCatalogMetadataDump,
  readableListingCaption,
} from "@/lib/inventory/context-hooks"
import type { MarketingEntity } from "@/lib/inventory/types"

/**
 * Post copy from intake. Website dumps that repeat Brand/Size/Condition are
 * cleaned so Canvas tags own those facts and the caption stays readable.
 */
export function listingCaptionForPost(item: MarketingEntity): string {
  const meta = item.copy_draft?.metadata
  const fromApproved = meta?.post_description?.trim()
  if (fromApproved && !isCatalogMetadataDump(fromApproved)) {
    return fromApproved
  }
  const fromDraft = item.copy_draft?.caption?.trim()
  if (fromDraft && !isCatalogMetadataDump(fromDraft)) {
    return fromDraft
  }
  // Approved/draft that is still a catalog dump → clean it.
  const preferred = fromApproved || fromDraft || item.description?.trim() || ""
  const cleaned = readableListingCaption({
    title: item.title,
    description: preferred || item.description,
    brand: item.brand,
  })
  if (cleaned) return cleaned
  return item.title?.trim() ?? ""
}

export function listingTagsForPost(input: {
  item: MarketingEntity
  brandName: string
  industry?: string | null
}): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  function push(raw: string | null | undefined) {
    const tag = raw ? normalizeOptTag(raw) : null
    if (!tag || seen.has(tag)) return
    seen.add(tag)
    out.push(tag)
  }
  for (const tag of input.item.copy_draft?.tags ?? []) {
    push(tag)
  }
  for (const tag of buildOptimizationTags({
    item: input.item,
    brandName: input.brandName,
    industry: input.industry,
    listingVibe: input.item.vibe,
  })) {
    push(tag)
  }
  return out
}

/** One feed caption when the tray spans multiple intake items. */
export function mergeTrayIntakeCaptions(
  captions: Array<string | null | undefined>
): string {
  const blocks: string[] = []
  const seen = new Set<string>()
  for (const raw of captions) {
    const text = raw?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    blocks.push(text)
  }
  return blocks.join("\n\n")
}

export function mergeTagSuggestions(
  ...groups: Array<string[] | undefined>
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    if (!group) continue
    for (const raw of group) {
      const tag = normalizeOptTag(raw)
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      out.push(tag)
    }
  }
  return out
}
