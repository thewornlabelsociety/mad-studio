import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import { parseLabeledFields } from "@/lib/inventory/context-hooks"
import {
  mapMarketingEntityRow,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { compareNewestArrival } from "@/lib/inventory/arrival-order"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import { extractSizeLabel } from "@/lib/marketing/story-presets"
import { stripAuSizePrefix } from "@/lib/studio/canvas-size-tag-label"
import { readTodayDeckDismissStatus } from "@/lib/today/today-deck-dismiss"
import { patchDropWorkbenchDraft } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import {
  listingCaptionForPost,
  listingTagsForPost,
} from "@/lib/studio/intake-listing-copy"
import { firstUsableProductImageUrl } from "@/lib/inventory/wls-product-eligibility"

const ITEM_SELECT =
  "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"

export type SuggestedFormat = "carousel" | "reel" | "story" | "single"

export type NewArrivalSuggestion = {
  item: MarketingEntity
  media: Array<{ url: string; kind: "image" | "video" }>
  format: SuggestedFormat
  /** Why this format, in a few words. */
  reason: string
  facts: CanvasItemFacts
  intakeCaption: string
  intakeTags: string[]
}

export const SUGGESTED_FORMAT_LABELS: Record<SuggestedFormat, string> = {
  carousel: "Carousel",
  reel: "Reel",
  story: "Story + link",
  single: "Single post",
}

/**
 * Pick the format that shows an item off best with what we have:
 * video → Reel; 3+ photos → feed carousel; otherwise a Story with a shop link
 * (fashion) or a single feed post.
 */
export function suggestFormat(input: {
  media: NewArrivalSuggestion["media"]
  isFashion: boolean
}): { format: SuggestedFormat; reason: string } {
  const videos = input.media.filter((row) => row.kind === "video").length
  const photos = input.media.length - videos
  if (videos > 0) {
    return { format: "reel", reason: "Has video — Reels reach the most people" }
  }
  if (photos >= 3) {
    return {
      format: "carousel",
      reason: `${photos} photos — swipe through front, detail and label`,
    }
  }
  if (input.isFashion) {
    return {
      format: "story",
      reason: "Cutout card with a link straight to the listing",
    }
  }
  return { format: "single", reason: "One strong photo for the feed" }
}

export function itemFactsFor(
  item: MarketingEntity,
  isFashion: boolean
): CanvasItemFacts {
  // Website sync often leaves brand/size only in the description body
  // ("Brand: Zimmermann · Size: 1") — Canvas tags must read those labels.
  const labeled = parseLabeledFields(item.description ?? "")
  const brand =
    item.copy_draft?.metadata?.post_brand?.trim() ||
    item.brand?.trim() ||
    labeled.brand?.trim() ||
    null
  const size = isFashion
    ? (() => {
        const raw =
          item.listing_size?.trim() ||
          item.copy_draft?.metadata?.post_size?.trim() ||
          extractSizeLabel(item) ||
          labeled.size?.trim() ||
          ""
        const stripped = raw ? stripAuSizePrefix(raw) : ""
        return stripped ? stripped.toUpperCase() : null
      })()
    : null
  return {
    brand,
    size,
    price: priceText(item.price),
    vibe: item.vibe?.trim() || labeled.colour?.trim() || null,
    newLabel: isFashion ? "New consignment" : "Just in",
  }
}

/**
 * Fill Canvas Brand / Size / Price / Vibe from listing facts (description).
 * Empty fields only — never overwrite what the operator already typed.
 * Turns on tags that have a value so they show on the phone.
 */
export function overlayPatchFromItemFacts(input: {
  facts: CanvasItemFacts
  /** When true, also enable empty tag slots that now have a fact value. */
  enableTags?: boolean
}): {
  tagBrand: string
  tagSize: string
  tagPrice: string
  tagVibe: string
  tagNewLabel: string
  tagShowBrand?: boolean
  tagShowSize?: boolean
  tagShowPrice?: boolean
  tagShowVibe?: boolean
  enabled?: boolean
} {
  const brand = input.facts.brand?.trim() ?? ""
  const size = input.facts.size?.trim() ?? ""
  const price = input.facts.price?.trim() ?? ""
  const vibe = input.facts.vibe?.trim() ?? ""
  const newLabel = input.facts.newLabel?.trim() ?? ""
  const enable = input.enableTags !== false
  const hasAny = Boolean(brand || size || price || vibe)
  return {
    tagBrand: brand,
    tagSize: size,
    tagPrice: price,
    tagVibe: vibe,
    tagNewLabel: newLabel || "New consignment",
    ...(enable
      ? {
          tagShowBrand: Boolean(brand),
          tagShowSize: Boolean(size),
          tagShowPrice: Boolean(price),
          tagShowVibe: Boolean(vibe),
          ...(hasAny ? { enabled: true } : null),
        }
      : null),
  }
}

/** "$180", or "$179.50" when there are cents. */
function priceText(price: number | null): string | null {
  if (price == null || !Number.isFinite(price)) return null
  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`
}

function mediaOf(item: MarketingEntity): NewArrivalSuggestion["media"] {
  const urls: string[] = []
  for (const raw of item.images) {
    const usable = firstUsableProductImageUrl([raw]) ?? raw.trim()
    if (/^https?:\/\//i.test(usable)) urls.push(usable)
  }
  return urls.slice(0, 10).map((url) => ({
    url,
    kind: detectMediaKindFromUrl(url) === "video" ? "video" : "image",
  }))
}

/** Rows eligible for the Suggested New Arrivals list (before photo/format mapping). */
export function filterNewArrivalCatalogItems(
  items: MarketingEntity[]
): MarketingEntity[] {
  return [...items]
    .sort(compareNewestArrival)
    .filter((item) => {
      if (item.status !== "unfeatured") return false
      const dismissed = readTodayDeckDismissStatus(item.copy_draft ?? null)
      if (dismissed === "skipped" || dismissed === "archived") return false
      return !item.copy_draft?.metadata?.studio_used_at
    })
}

/** Map inventory rows to New Arrival suggestion cards (shared with parity tests). */
export function mapNewArrivalSuggestions(input: {
  items: MarketingEntity[]
  brandName: string
  industry?: string | null
  isFashion: boolean
  limit?: number
}): NewArrivalSuggestion[] {
  return filterNewArrivalCatalogItems(input.items)
    .map((item) => {
      const media = mediaOf(item)
      return {
        item,
        media,
        ...suggestFormat({ media, isFashion: input.isFashion }),
        facts: itemFactsFor(item, input.isFashion),
        intakeCaption: listingCaptionForPost(item),
        intakeTags: listingTagsForPost({
          item,
          brandName: input.brandName,
          industry: input.industry,
        }),
      }
    })
    .filter((row) => row.media.length > 0)
    .slice(0, input.limit ?? 12)
}

/**
 * New arrivals that haven't been posted yet (the same items Today lists as
 * new drops), newest first. Read-only.
 */
export async function fetchNewArrivalSuggestions(input: {
  entityId: string
  brandName: string
  industry?: string | null
  isFashion: boolean
  limit?: number
}): Promise<NewArrivalSuggestion[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("marketing_entities")
    .select(ITEM_SELECT)
    .eq("entity_id", input.entityId)
    .eq("status", "unfeatured")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)

  return mapNewArrivalSuggestions({
    items: (data ?? []).map((row) => mapMarketingEntityRow(row)),
    brandName: input.brandName,
    industry: input.industry,
    isFashion: input.isFashion,
    limit: input.limit,
  })
}

/** Mark an arrival as used (or not) so it leaves the suggestions list. */
export async function setArrivalUsed(input: {
  entityId: string
  itemId: string
  used: boolean
}): Promise<boolean> {
  const result = (await patchDropWorkbenchDraft({
    entityId: input.entityId,
    itemId: input.itemId,
    copyDraft: {
      metadata: {
        studio_used_at: input.used ? new Date().toISOString() : null,
      },
    },
  })) as { ok?: boolean } | undefined
  return Boolean(result?.ok)
}

/** Facts for one item (used when photos come from the media library). */
export async function fetchItemFacts(
  marketingEntityId: string,
  isFashion: boolean
): Promise<CanvasItemFacts | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("marketing_entities")
    .select(ITEM_SELECT)
    .eq("id", marketingEntityId)
    .maybeSingle()
  return data ? itemFactsFor(mapMarketingEntityRow(data), isFashion) : null
}

/** Items by id, in the order given, with their photos and tag facts (Build from Today). */
export async function fetchItemsForStudio(
  itemIds: string[],
  isFashion: boolean
): Promise<Array<{ item: MarketingEntity; media: NewArrivalSuggestion["media"]; facts: CanvasItemFacts }>> {
  if (itemIds.length === 0) return []
  const supabase = createClient()
  const { data, error } = await supabase
    .from("marketing_entities")
    .select(ITEM_SELECT)
    .in("id", itemIds)
  if (error) throw new Error(error.message)
  const byId = new Map((data ?? []).map((row) => [row.id, mapMarketingEntityRow(row)]))
  return itemIds.flatMap((id) => {
    const item = byId.get(id)
    if (!item) return []
    return [{ item, media: mediaOf(item), facts: itemFactsFor(item, isFashion) }]
  })
}
