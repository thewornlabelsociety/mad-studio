import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import {
  mapMarketingEntityRow,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import { extractSizeLabel } from "@/lib/marketing/story-presets"
import { readTodayDeckDismissStatus } from "@/lib/today/today-deck-dismiss"
import { patchDropWorkbenchDraft } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"

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
  const brand =
    item.copy_draft?.metadata?.post_brand?.trim() || item.brand?.trim() || null
  return {
    brand,
    size: isFashion ? extractSizeLabel(item) : null,
    price: priceText(item.price),
    vibe: item.vibe ?? null,
    newLabel: isFashion ? "New consignment" : "Just in",
  }
}

/** "$180", or "$179.50" when there are cents. */
function priceText(price: number | null): string | null {
  if (price == null || !Number.isFinite(price)) return null
  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`
}

function mediaOf(item: MarketingEntity): NewArrivalSuggestion["media"] {
  return item.images
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .slice(0, 10)
    .map((url) => ({
      url,
      kind: detectMediaKindFromUrl(url) === "video" ? "video" : "image",
    }))
}

/**
 * New arrivals that haven't been posted yet (the same items Today lists as
 * new drops), newest first. Read-only.
 */
export async function fetchNewArrivalSuggestions(input: {
  entityId: string
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
    .limit(input.limit ?? 12)
  if (error) throw new Error(error.message)

  return (data ?? [])
    .map((row) => mapMarketingEntityRow(row))
    .filter((item) => {
      const dismissed = readTodayDeckDismissStatus(item.copy_draft ?? null)
      if (dismissed === "skipped" || dismissed === "archived") return false
      // Already picked from these suggestions (still in the media library).
      return !item.copy_draft?.metadata?.studio_used_at
    })
    .map((item) => {
      const media = mediaOf(item)
      return {
        item,
        media,
        ...suggestFormat({ media, isFashion: input.isFashion }),
        facts: itemFactsFor(item, input.isFashion),
      }
    })
    .filter((row) => row.media.length > 0)
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
