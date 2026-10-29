import { z } from "zod"

import {
  readListingAvailability,
  readListingCurrency,
  readListingSyncedAt,
  readListingUrl,
  readVerifiedListingSize,
  type ListingAvailability,
} from "./listing-availability.ts"
import { readListingVibeFromMetrics } from "./listing-vibe.ts"
import {
  readListingGarmentFromMetrics,
  type GarmentGender,
} from "./listing-garment.ts"
import { readListingMarkdownFromMetrics } from "./listing-markdown.ts"

export const MARKETING_ENTITY_STATUSES = [
  "unfeatured",
  "draft",
  "approved",
  "scheduled",
  "published",
] as const

export type MarketingEntityStatus = (typeof MARKETING_ENTITY_STATUSES)[number]

export const DISPATCH_CHANNELS = [
  "instagram_feed",
  "facebook",
  "email_newsletter",
] as const

export type DispatchChannel = (typeof DISPATCH_CHANNELS)[number]

export type MarketingEntityMetrics = {
  views: number
  clicks: number
  sales: number
  impressions?: number
  reach?: number
  saved?: number
}

export type MarketingCopyDraft = {
  headline?: string
  caption?: string
  /** Search / discovery tags (no #) for IG/TikTok optimisation. */
  tags?: string[]
  platform?: "feed" | "story" | "email"
  /** Public HTTPS media URL locked in when the drop was scheduled. */
  media_url?: string
  /** Meta placement hint when the scheduled channel is Instagram. */
  placement?: "feed" | "story"
  /** Saved per-channel slots (see lib/scheduling/brain-timing ChannelSlot). */
  dispatch_plan?: unknown[]
  /** FÜDI Supabase intake metadata (target URL, source table, etc.). */
  metadata?: {
    target_url?: string | null
    source_table?: string | null
    original_id?: string | null
    item_type?: string | null
    location?: string | null
    /** Operator override for Today / workbench drop badge (FÜDI). */
    drop_kind?: string | null
    /** Operator override for channel hint chip, e.g. TikTok / IG Story. */
    channel_hint?: string | null
    /** Operator override for listing vibe (hooks + tags). */
    listing_vibe?: string | null
    /** On-image text styling (position, font, colors) for publish preview. */
    canvas_text_overlay?: unknown
    /**
     * Operator-set post details. Kept apart from the synced listing columns so
     * a website re-sync never overwrites what was approved for posting.
     */
    post_brand?: string | null
    post_size?: string | null
    post_description?: string | null
    post_description_approved_at?: string | null
    /** Last story template picked in the Story maker. */
    story_template?: "cutout" | "full_page" | null
    /** Background-removed PNG for the Cutout story template. */
    cutout_url?: string | null
    /** Intake channel for Today badges (mobile_drop, auto_trigger, …). */
    origin?: string | null
    sender?: string | null
    auto_template?: string | null
    /** Today swipe deck: skipped or archived — hide from pending deck even if still unfeatured. */
    today_deck_status?: "skipped" | "archived" | null
    today_deck_dismissed_at?: string | null
    /** Picked from Studio's new-arrival suggestions — hide it there. */
    studio_used_at?: string | null
    /** WLS Daily New Arrival Story draft attribution (Checkpoint B). */
    wls_daily_story?: unknown
    /** When this item's new arrival Story was marked shared from Today. */
    wls_story_shared_at?: string | null
  }
}

export type PublishedMediaIds = {
  instagram?: string
  instagram_story?: string
  facebook?: string
  tiktok?: string
  [key: string]: string | undefined
}

export type MarketingEntity = {
  id: string
  entity_id: string
  website_item_id: string
  title: string
  brand: string | null
  price: number | null
  description: string | null
  images: string[]
  status: MarketingEntityStatus
  metrics: MarketingEntityMetrics
  /** Catalogue availability from last successful website sync (metrics). */
  listing_availability: ListingAvailability
  listing_synced_at: string | null
  /** Explicit size from source listing — never a title heuristic. */
  listing_size: string | null
  listing_currency: string
  listing_url: string | null
  /** Primary Shop-by-Vibe label from the source listing (website aesthetic). */
  vibe: string | null
  /** Marketplace category and gender from the last sync, when the feed has them. */
  listing_category?: string | null
  listing_gender?: GarmentGender | null
  /** Full price before a shop markdown; null when the item is not discounted. */
  listing_was_price?: number | null
  listing_discounted_at?: string | null
  aesthetic_slugs: string[]
  scheduled_at: string | null
  channels: string[]
  copy_draft: MarketingCopyDraft
  published_media_ids: PublishedMediaIds
  trackable_slug: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type ScheduledSlotOccupancy = {
  id: string
  title: string
  scheduled_at: string
  channels: string[]
}

export const websiteSyncItemSchema = z.object({
  website_item_id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  brand: z.string().max(200).optional().nullable(),
  price: z.union([z.number(), z.string()]).optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
  images: z.array(z.string().url()).max(20).optional().default([]),
})

export const websiteSyncRequestSchema = z.object({
  entity_id: z.string().uuid().optional(),
  entity_slug: z.string().min(1).max(200).optional(),
  item: websiteSyncItemSchema.optional(),
  items: z.array(websiteSyncItemSchema).max(100).optional(),
})

export type WebsiteSyncRequest = z.infer<typeof websiteSyncRequestSchema>

export function parseMetrics(value: unknown): MarketingEntityMetrics {
  if (!value || typeof value !== "object") {
    return { views: 0, clicks: 0, sales: 0 }
  }
  const record = value as Record<string, unknown>
  return {
    views: toNonNegInt(record.views),
    clicks: toNonNegInt(record.clicks),
    sales: toNonNegInt(record.sales),
    impressions:
      record.impressions == null ? undefined : toNonNegInt(record.impressions),
    reach: record.reach == null ? undefined : toNonNegInt(record.reach),
    saved: record.saved == null ? undefined : toNonNegInt(record.saved),
  }
}

export function parsePublishedMediaIds(value: unknown): PublishedMediaIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: PublishedMediaIds = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry.trim()) out[key] = entry.trim()
  }
  return out
}

export function parseCopyDraft(value: unknown): MarketingCopyDraft {
  if (!value || typeof value !== "object") return {}
  const record = value as Record<string, unknown>
  return {
    headline: typeof record.headline === "string" ? record.headline : undefined,
    caption: typeof record.caption === "string" ? record.caption : undefined,
    tags: Array.isArray(record.tags)
      ? record.tags
          .filter((row): row is string => typeof row === "string")
          .map((row) => row.trim().replace(/^#/, ""))
          .filter(Boolean)
          .slice(0, 20)
      : undefined,
    platform:
      record.platform === "feed" ||
      record.platform === "story" ||
      record.platform === "email"
        ? record.platform
        : undefined,
    media_url:
      typeof record.media_url === "string" &&
      /^https?:\/\//i.test(record.media_url.trim())
        ? record.media_url.trim()
        : undefined,
    placement:
      record.placement === "feed" || record.placement === "story"
        ? record.placement
        : undefined,
    dispatch_plan: Array.isArray(record.dispatch_plan)
      ? record.dispatch_plan
      : undefined,
    metadata: parseCopyDraftMetadata(record.metadata),
  }
}

/** Preserves usage / dismiss / post fields across read→write cycles. */
export function parseCopyDraftMetadata(
  value: unknown
): MarketingCopyDraft["metadata"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  const record = value as Record<string, unknown>
  const str = (key: string) =>
    typeof record[key] === "string" ? record[key] : undefined
  const target_url = str("target_url")
  const source_table = str("source_table")
  const original_id = str("original_id")
  const item_type = str("item_type")
  const location = str("location")
  const drop_kind = str("drop_kind")
  const channel_hint = str("channel_hint")
  const listing_vibe = str("listing_vibe")
  const post_brand = str("post_brand")
  const post_size = str("post_size")
  const post_description = str("post_description")
  const post_description_approved_at = str("post_description_approved_at")
  const story_template =
    record.story_template === "cutout" || record.story_template === "full_page"
      ? record.story_template
      : undefined
  const cutout_url = str("cutout_url")
  const origin = str("origin")
  const sender = str("sender")
  const auto_template = str("auto_template")
  const today_deck_status =
    record.today_deck_status === "skipped" ||
    record.today_deck_status === "archived"
      ? record.today_deck_status
      : undefined
  const today_deck_dismissed_at = str("today_deck_dismissed_at")
  const studio_used_at = str("studio_used_at")
  const wls_story_shared_at = str("wls_story_shared_at")
  const canvas_text_overlay =
    record.canvas_text_overlay !== undefined
      ? record.canvas_text_overlay
      : undefined
  const wls_daily_story =
    record.wls_daily_story !== undefined ? record.wls_daily_story : undefined
  if (
    !target_url &&
    !source_table &&
    !original_id &&
    !item_type &&
    !location &&
    !drop_kind &&
    !channel_hint &&
    !listing_vibe &&
    !post_brand &&
    !post_size &&
    !post_description &&
    !post_description_approved_at &&
    !story_template &&
    !cutout_url &&
    !origin &&
    !sender &&
    !auto_template &&
    !today_deck_status &&
    !today_deck_dismissed_at &&
    !studio_used_at &&
    !wls_story_shared_at &&
    canvas_text_overlay === undefined &&
    wls_daily_story === undefined
  ) {
    return undefined
  }
  return {
    target_url: target_url ?? null,
    source_table: source_table ?? null,
    original_id: original_id ?? null,
    item_type: item_type ?? null,
    location: location ?? null,
    drop_kind: drop_kind ?? null,
    channel_hint: channel_hint ?? null,
    listing_vibe: listing_vibe ?? null,
    canvas_text_overlay,
    post_brand: post_brand ?? null,
    post_size: post_size ?? null,
    post_description: post_description ?? null,
    post_description_approved_at: post_description_approved_at ?? null,
    story_template: story_template ?? null,
    cutout_url: cutout_url ?? null,
    origin: origin ?? null,
    sender: sender ?? null,
    auto_template: auto_template ?? null,
    today_deck_status: today_deck_status ?? null,
    today_deck_dismissed_at: today_deck_dismissed_at ?? null,
    studio_used_at: studio_used_at ?? null,
    wls_story_shared_at: wls_story_shared_at ?? null,
    wls_daily_story,
  }
}

function toNonNegInt(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.round(num)
}

export function parsePrice(value: unknown): number | null {
  if (value == null || value === "") return null
  const num =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ""))
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100) / 100
}

export function formatInventoryPrice(price: number | null): string {
  if (price == null) return "—"
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(price)
}

export function mapMarketingEntityRow(row: {
  id: string
  entity_id: string
  website_item_id: string
  title: string
  brand: string | null
  price: number | null
  description: string | null
  images: string[] | null
  status: string
  metrics: unknown
  scheduled_at: string | null
  channels?: string[] | null
  copy_draft?: unknown
  published_media_ids?: unknown
  trackable_slug?: string | null
  published_at?: string | null
  created_at: string
  updated_at: string
}): MarketingEntity {
  const listingVibe = readListingVibeFromMetrics(row.metrics)
  const listingGarment = readListingGarmentFromMetrics(row.metrics)
  const listingMarkdown = readListingMarkdownFromMetrics(row.metrics)
  const descriptionVibe =
    typeof row.description === "string"
      ? row.description.match(/\bVibe\s*:\s*([^·|]+)/i)?.[1]?.trim() || null
      : null
  return {
    id: row.id,
    entity_id: row.entity_id,
    website_item_id: row.website_item_id,
    title: row.title,
    brand: row.brand,
    price: row.price == null ? null : Number(row.price),
    description: row.description,
    images: Array.isArray(row.images) ? row.images : [],
    status: row.status as MarketingEntityStatus,
    metrics: parseMetrics(row.metrics),
    listing_availability: readListingAvailability(row.metrics),
    listing_synced_at: readListingSyncedAt(row.metrics),
    listing_size: readVerifiedListingSize(row.metrics),
    listing_currency: readListingCurrency(row.metrics),
    listing_url: readListingUrl(row.metrics),
    vibe: listingVibe.vibe || descriptionVibe,
    listing_category: listingGarment.category,
    listing_gender: listingGarment.gender,
    listing_was_price: listingMarkdown.wasPrice,
    listing_discounted_at: listingMarkdown.discountedAt,
    aesthetic_slugs: listingVibe.aesthetic_slugs,
    scheduled_at: row.scheduled_at,
    channels: Array.isArray(row.channels) ? row.channels : [],
    copy_draft: parseCopyDraft(row.copy_draft),
    published_media_ids: parsePublishedMediaIds(row.published_media_ids),
    trackable_slug: row.trackable_slug ?? null,
    published_at: row.published_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
