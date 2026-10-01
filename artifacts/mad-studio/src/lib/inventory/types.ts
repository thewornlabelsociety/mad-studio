import { z } from "zod"

import { readListingVibeFromMetrics } from "@/lib/inventory/listing-vibe"

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
    /** Intake channel for Today badges (mobile_drop, auto_trigger, …). */
    origin?: string | null
    sender?: string | null
    auto_template?: string | null
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
  /** Primary Shop-by-Vibe label from the source listing (website aesthetic). */
  vibe: string | null
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

function parseCopyDraftMetadata(
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
  if (
    !target_url &&
    !source_table &&
    !original_id &&
    !item_type &&
    !location &&
    !drop_kind &&
    !channel_hint &&
    !listing_vibe
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
    vibe: listingVibe.vibe || descriptionVibe,
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
