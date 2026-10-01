import { cleanHashtags } from "@/lib/copy/caption-hygiene"
import { scrubAgencyLeak } from "@/lib/inventory/context-hooks"
import { stripDuplicateHookFromCaption } from "@/lib/inventory/sop"
import { OPTIMIZATION_TAG_MAX } from "@/lib/inventory/optimization-tags"

import {
  FUDI_CAROUSEL_BANNED_TERMS,
  type CarouselPromoAngle,
  type CarouselSuggestItem,
} from "@/lib/today/carousel-suggest-types"

function scrubBanned(text: string): string {
  let out = scrubAgencyLeak(text)
  for (const term of FUDI_CAROUSEL_BANNED_TERMS) {
    out = out.replace(new RegExp(term, "gi"), "")
  }
  return out.replace(/\s{2,}/g, " ").trim()
}

export function normalizeRecommendedOrder(
  order: number[],
  itemCount: number
): number[] {
  const valid = order.filter(
    (index) => Number.isInteger(index) && index >= 0 && index < itemCount
  )
  const seen = new Set<number>()
  const unique: number[] = []
  for (const index of valid) {
    if (seen.has(index)) continue
    seen.add(index)
    unique.push(index)
  }
  for (let i = 0; i < itemCount; i += 1) {
    if (!seen.has(i)) unique.push(i)
  }
  return unique.slice(0, itemCount)
}

export function sanitizeCarouselAngle(
  angle: CarouselPromoAngle,
  itemCount: number
): CarouselPromoAngle {
  const hook = scrubBanned(angle.hook).slice(0, 200)
  let caption = scrubBanned(angle.caption).slice(0, 2200)
  caption = stripDuplicateHookFromCaption(hook, caption)

  const slide_subheads = angle.slide_subheads
    .slice(0, itemCount)
    .map((row) => scrubBanned(row).slice(0, 80))
  while (slide_subheads.length < itemCount) {
    slide_subheads.push("")
  }

  const hero = Math.min(
    Math.max(angle.hero_item_index, 0),
    Math.max(itemCount - 1, 0)
  )

  return {
    id: angle.id.trim() || "angle",
    angle_title: scrubBanned(angle.angle_title).slice(0, 120) || "Promo angle",
    reasoning: scrubBanned(angle.reasoning).slice(0, 400),
    hero_item_index: hero,
    recommended_order: normalizeRecommendedOrder(
      angle.recommended_order,
      itemCount
    ),
    hook,
    slide_subheads,
    caption,
    tags: cleanHashtags(
      angle.tags.map((tag) => tag.trim()).filter(Boolean),
      { max: OPTIMIZATION_TAG_MAX }
    ),
  }
}

export function carouselItemsFromSelection(
  queue: Array<{
    item: { id: string; description: string | null; price: number | null }
    displayTitle: string
    mediaUrl: string | null
    venueOrBrand: string | null
  }>,
  selectedIds: string[]
): CarouselSuggestItem[] {
  return selectedIds
    .map((id) => queue.find((row) => row.item.id === id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row?.mediaUrl))
    .map((row) => ({
      title: row.displayTitle.trim(),
      venue: row.venueOrBrand?.trim() || undefined,
      price:
        row.item.price != null && row.item.price > 0
          ? String(row.item.price)
          : undefined,
      description: row.item.description?.trim().slice(0, 400) || undefined,
      imageUrl: row.mediaUrl!.trim(),
    }))
}

export function orderedSourceIds(
  selectedIds: string[],
  recommendedOrder: number[]
): string[] {
  const order = normalizeRecommendedOrder(recommendedOrder, selectedIds.length)
  return order.map((index) => selectedIds[index]!).filter(Boolean)
}
