import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isListingAvailableForSale,
  type ListingAvailability,
} from "./listing-availability.ts"
import { compareNewestArrival } from "./arrival-order.ts"
import {
  mapMarketingEntityRow,
  type MarketingEntity,
  type MarketingEntityStatus,
} from "./types.ts"

export type WlsTemplateKind = "daily_story" | "flatlay"

/** Blocks selection — server and UI must agree. */
export type WlsHardBlockReason =
  | "wrong_entity"
  | "not_available"
  | "missing_image"
  | "missing_title"
  | "missing_shop_link"
  | "queued_for_publish"

/** Marketing hints only — product stays selectable. */
export type WlsSoftWarningReason =
  | "check_stock"
  | "missing_price"
  | "no_verified_size"
  | "featured_recently"
  | "used_before"
  | "creative_in_progress"

/** @deprecated Prefer hardBlockers — kept for API summaries. */
export type WlsExclusionReason = WlsHardBlockReason

export type WlsAvailabilityBadge = "in_stock" | "sold" | "unavailable" | "verify"

export type WlsMarketingLifecycle =
  | "synced"
  | "drafted"
  | "approved"
  | "scheduled"
  | "published"
  | "dismissed"

/** Entity-scoped product selection contract for Story / Flatlay templates. */
export type WlsProductSelection = {
  /** Stable MAD row id — use for draft duplicate prevention. */
  marketingEntityId: string
  /** Stable WLS catalogue id (website_item_id). */
  websiteItemId: string
  entityId: string
  brand: string | null
  title: string
  description: string | null
  /** Shop-by-Vibe label from the website listing, when it has one. */
  vibe?: string | null
  /** Explicit listing size only — never invented. */
  size: string | null
  price: number | null
  currency: string
  sourceImageUrls: string[]
  destinationUrl: string | null
  availability: ListingAvailability
  lastSyncedAt: string | null
  usage: {
    marketingStatus: MarketingEntityStatus
    lifecycle: WlsMarketingLifecycle
    studioUsedAt: string | null
    todayDeckStatus: "skipped" | "archived" | null
    todayDeckDismissedAt: string | null
    publishedAt: string | null
  }
  /** Feed / manual Create — photo-led; shop link not required. */
  feedSelectable: boolean
  /** Story template + link sticker — shop link required. */
  storySelectable: boolean
  /** @deprecated Use feedSelectable in the strip. */
  selectable: boolean
  /** Story handoff eligibility (legacy API field). */
  eligible: boolean
  /** Blocks feed and story (sold, missing photo, etc.). */
  hardBlockers: WlsHardBlockReason[]
  /** Story-only blocks (includes missing shop link). */
  storyHardBlockers: WlsHardBlockReason[]
  softWarnings: WlsSoftWarningReason[]
  availabilityBadge: WlsAvailabilityBadge
  /** Hard blockers only (legacy field). */
  exclusionReasons: WlsHardBlockReason[]
  template: WlsTemplateKind
}

export type WlsEligibilityOptions = {
  entityId: string
  websiteUrl?: string | null
  template: WlsTemplateKind
  /** Default 14 days. Items featured/published inside this window are excluded. */
  reuseCooldownMs?: number
  nowMs?: number
}

const DEFAULT_REUSE_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

/** Fallback when entity.website_url is empty — WLS marketplace handoff still needs a URL. */
export const WLS_MARKETPLACE_ORIGIN = "https://www.wornlabelsociety.co.nz"

const STALE_UNAVAILABLE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** Only block when a post is already queued — not mere creative drafts on the row. */
const BLOCKING_WORKFLOW_STATUSES = new Set<MarketingEntityStatus>(["scheduled"])

/** Build the public WLS marketplace URL without inventing product ids. */
export function buildWlsDestinationUrl(input: {
  websiteUrl?: string | null
  websiteItemId: string
  listingUrl?: string | null
}): string | null {
  if (
    input.listingUrl &&
    /^https?:\/\//i.test(input.listingUrl.trim())
  ) {
    return input.listingUrl.trim()
  }

  const itemId = input.websiteItemId?.trim()
  if (!itemId) return null

  const websiteRaw =
    input.websiteUrl?.trim() ||
    (/^(ig-|fudi-|demo-)/i.test(itemId) ? "" : WLS_MARKETPLACE_ORIGIN)
  if (!websiteRaw) return null

  try {
    const base = new URL(
      /^https?:\/\//i.test(websiteRaw)
        ? websiteRaw
        : `https://${websiteRaw}`
    )
    if (/wornlabelsociety\.co\.nz$/i.test(base.hostname.replace(/^www\./i, ""))) {
      base.hostname = "www.wornlabelsociety.co.nz"
    }
    return `${base.origin}/marketplace/listings/${encodeURIComponent(itemId)}`
  } catch {
    return null
  }
}

export function resolveWlsMarketingLifecycle(
  item: MarketingEntity
): WlsMarketingLifecycle {
  const deck = item.copy_draft?.metadata?.today_deck_status
  if (deck === "skipped" || deck === "archived") return "dismissed"
  switch (item.status) {
    case "published":
      return "published"
    case "scheduled":
      return "scheduled"
    case "approved":
      return "approved"
    case "draft":
      return "drafted"
    default:
      return "synced"
  }
}

export function firstUsableProductImageUrl(urls: string[]): string | null {
  for (const raw of urls) {
    const url = raw.trim()
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith("//") && url.length > 2) return `https:${url}`
  }
  return null
}

function availabilityBadgeFor(
  availability: ListingAvailability
): WlsAvailabilityBadge {
  if (availability === "sold") return "sold"
  if (availability === "unavailable") return "unavailable"
  if (availability === "unknown") return "verify"
  return "in_stock"
}

/** Cooldown applies to items already published through MAD — not Studio browsing. */
function isRecentlyPublished(input: {
  item: MarketingEntity
  cooldownMs: number
  nowMs: number
}): boolean {
  if (input.item.status !== "published") return false
  if (!input.item.published_at) return false
  const publishedMs = Date.parse(input.item.published_at)
  return (
    Number.isFinite(publishedMs) &&
    input.nowMs - publishedMs < input.cooldownMs
  )
}

function effectiveListingAvailability(item: MarketingEntity): ListingAvailability {
  const stored = item.listing_availability
  if (stored === "sold") return "sold"
  if (stored === "unavailable") {
    const synced = item.listing_synced_at
    if (synced) {
      const ms = Date.parse(synced)
      if (
        Number.isFinite(ms) &&
        Date.now() - ms < STALE_UNAVAILABLE_GRACE_MS
      ) {
        return "unavailable"
      }
    }
    // Stale "missing from last pull" flags should not block Studio selection.
    return "available"
  }
  if (stored === "available") return "available"
  if (stored === "unknown" && item.status === "unfeatured") return "available"
  if (item.website_item_id?.trim()) return "available"
  return "unknown"
}

/**
 * Pure eligibility evaluator for one marketing entity row.
 * Missing/uncertain availability is never treated as available.
 */
export function evaluateWlsProductEligibility(
  item: MarketingEntity,
  options: WlsEligibilityOptions
): WlsProductSelection {
  const cooldownMs = options.reuseCooldownMs ?? DEFAULT_REUSE_COOLDOWN_MS
  const nowMs = options.nowMs ?? Date.now()
  const hardBlockers: WlsHardBlockReason[] = []
  const softWarnings: WlsSoftWarningReason[] = []

  if (item.entity_id !== options.entityId) {
    hardBlockers.push("wrong_entity")
  }

  const availability = effectiveListingAvailability(item)
  if (availability === "unknown") {
    softWarnings.push("check_stock")
  } else if (!isListingAvailableForSale(availability)) {
    hardBlockers.push("not_available")
  }

  const title = item.title?.trim() ?? ""
  if (!title) hardBlockers.push("missing_title")

  const sourceImageUrls = Array.isArray(item.images) ? item.images : []
  if (!firstUsableProductImageUrl(sourceImageUrls)) {
    hardBlockers.push("missing_image")
  }

  const destinationUrl = buildWlsDestinationUrl({
    websiteUrl: options.websiteUrl,
    websiteItemId: item.website_item_id,
    listingUrl: item.listing_url,
  })

  const storyHardBlockers = [...hardBlockers]
  if (!destinationUrl || !/^https?:\/\//i.test(destinationUrl)) {
    storyHardBlockers.push("missing_shop_link")
  }

  if (item.price == null || !Number.isFinite(Number(item.price))) {
    softWarnings.push("missing_price")
  }

  if (BLOCKING_WORKFLOW_STATUSES.has(item.status)) {
    hardBlockers.push("queued_for_publish")
  }

  if (isRecentlyPublished({ item, cooldownMs, nowMs })) {
    softWarnings.push("featured_recently")
  }

  if (item.copy_draft?.metadata?.studio_used_at) {
    softWarnings.push("used_before")
  }

  if (item.status === "draft" || item.status === "approved") {
    softWarnings.push("creative_in_progress")
  }

  const verifiedSize =
    item.listing_size ?? item.copy_draft?.metadata?.post_size?.trim() ?? null
  if (!verifiedSize?.trim()) {
    softWarnings.push("no_verified_size")
  }

  const lifecycle = resolveWlsMarketingLifecycle(item)
  const feedSelectable = hardBlockers.length === 0
  const storySelectable = storyHardBlockers.length === 0

  return {
    marketingEntityId: item.id,
    websiteItemId: item.website_item_id,
    entityId: item.entity_id,
    brand: item.brand,
    title,
    description: item.description,
    vibe: item.vibe ?? null,
    size: verifiedSize,
    price: item.price == null ? null : Number(item.price),
    currency: item.listing_currency,
    sourceImageUrls,
    destinationUrl,
    availability,
    lastSyncedAt: item.listing_synced_at,
    usage: {
      marketingStatus: item.status,
      lifecycle,
      studioUsedAt: item.copy_draft?.metadata?.studio_used_at ?? null,
      todayDeckStatus: item.copy_draft?.metadata?.today_deck_status ?? null,
      todayDeckDismissedAt:
        item.copy_draft?.metadata?.today_deck_dismissed_at ?? null,
      publishedAt: item.published_at,
    },
    feedSelectable,
    storySelectable,
    selectable: feedSelectable,
    eligible: storySelectable,
    hardBlockers,
    storyHardBlockers,
    softWarnings,
    availabilityBadge: availabilityBadgeFor(availability),
    exclusionReasons: hardBlockers,
    template: options.template,
  }
}

export type WlsProductSelectionResult = {
  /** All evaluated rows — selectable first, then blocked. */
  catalog: WlsProductSelection[]
  eligible: WlsProductSelection[]
  excluded: WlsProductSelection[]
  exclusionSummary: Partial<Record<WlsHardBlockReason, number>>
  softWarningSummary: Partial<Record<WlsSoftWarningReason, number>>
}

export const WLS_HARD_BLOCK_LABELS: Record<WlsHardBlockReason, string> = {
  wrong_entity: "wrong brand",
  not_available: "sold or off the floor",
  missing_image: "needs a product photo",
  missing_title: "missing title",
  missing_shop_link: "needs a shop link",
  queued_for_publish: "already queued to post",
}

export const WLS_SOFT_WARNING_LABELS: Record<WlsSoftWarningReason, string> = {
  check_stock: "double-check stock",
  missing_price: "price missing",
  no_verified_size: "size not verified",
  featured_recently: "posted recently",
  used_before: "used in Studio before",
  creative_in_progress: "draft in progress",
}

export const WLS_AVAILABILITY_BADGE_LABELS: Record<
  WlsAvailabilityBadge,
  string
> = {
  in_stock: "In stock",
  sold: "Sold",
  unavailable: "Unavailable",
  verify: "Check stock",
}

export function ownerLabelForHardBlock(reason: WlsHardBlockReason): string {
  return WLS_HARD_BLOCK_LABELS[reason] ?? reason
}

export function ownerHintForSoftWarnings(
  warnings: WlsSoftWarningReason[],
  max = 2
): string {
  return warnings
    .slice(0, max)
    .map((w) => WLS_SOFT_WARNING_LABELS[w] ?? w)
    .join(" · ")
}

export function formatWlsExclusionSummary(
  summary: Partial<Record<WlsHardBlockReason, number>>,
  maxItems = 4
): string {
  const parts = (
    Object.entries(summary) as [WlsHardBlockReason, number][]
  )
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([reason, count]) => {
      const label = WLS_HARD_BLOCK_LABELS[reason] ?? reason
      return `${count} ${label}`
    })
  return parts.join(", ")
}

export function summarizeWlsHardBlockers(
  rows: WlsProductSelection[]
): Partial<Record<WlsHardBlockReason, number>> {
  const out: Partial<Record<WlsHardBlockReason, number>> = {}
  for (const row of rows) {
    for (const reason of row.hardBlockers) {
      out[reason] = (out[reason] ?? 0) + 1
    }
  }
  return out
}

export function summarizeWlsSoftWarnings(
  rows: WlsProductSelection[]
): Partial<Record<WlsSoftWarningReason, number>> {
  const out: Partial<Record<WlsSoftWarningReason, number>> = {}
  for (const row of rows) {
    for (const reason of row.softWarnings) {
      out[reason] = (out[reason] ?? 0) + 1
    }
  }
  return out
}

/** @deprecated Use summarizeWlsHardBlockers */
export function summarizeWlsExclusionReasons(
  excluded: WlsProductSelection[]
): Partial<Record<WlsHardBlockReason, number>> {
  return summarizeWlsHardBlockers(excluded)
}

/**
 * Server-side selector: load entity-scoped marketing_entities and evaluate
 * Story / Flatlay eligibility. Source images only — no generated creatives.
 */
export async function selectWlsProductsForTemplates(input: {
  supabase: SupabaseClient
  entityId: string
  websiteUrl?: string | null
  template: WlsTemplateKind
  reuseCooldownMs?: number
  limit?: number
  nowMs?: number
}): Promise<WlsProductSelectionResult> {
  const { data, error } = await input.supabase
    .from("marketing_entities")
    .select(
      "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
    )
    .eq("entity_id", input.entityId)
    .not("website_item_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 200, 1), 500))

  if (error) {
    throw new Error(error.message)
  }

  const options: WlsEligibilityOptions = {
    entityId: input.entityId,
    websiteUrl: input.websiteUrl,
    template: input.template,
    reuseCooldownMs: input.reuseCooldownMs,
    nowMs: input.nowMs,
  }

  const catalog: WlsProductSelection[] = []

  const rows = [...(data ?? [])].sort((a, b) =>
    compareNewestArrival(mapMarketingEntityRow(a), mapMarketingEntityRow(b))
  )

  for (const row of rows) {
    const item = mapMarketingEntityRow(row)
    catalog.push(evaluateWlsProductEligibility(item, options))
  }

  // Newest arrivals first (same as Today), hard-blocked rows at the end.
  catalog.sort((a, b) => {
    if (a.feedSelectable !== b.feedSelectable) return a.feedSelectable ? -1 : 1
    return compareNewestArrival(
      { website_item_id: a.websiteItemId, created_at: a.lastSyncedAt },
      { website_item_id: b.websiteItemId, created_at: b.lastSyncedAt }
    )
  })

  const eligible = catalog.filter((row) => row.storySelectable)
  const excluded = catalog.filter((row) => !row.feedSelectable)

  return {
    catalog,
    eligible,
    excluded,
    exclusionSummary: summarizeWlsHardBlockers(excluded),
    softWarningSummary: summarizeWlsSoftWarnings(catalog),
  }
}

const MARKETING_ENTITY_SELECT =
  "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"

/**
 * Load specific marketing_entities by id in caller order; each must be eligible
 * for the requested WLS template kind.
 */
export type WlsPickSurface = "feed" | "story"

export async function selectWlsProductsByIds(input: {
  supabase: SupabaseClient
  entityId: string
  websiteUrl?: string | null
  template: WlsTemplateKind
  marketingEntityIds: string[]
  reuseCooldownMs?: number
  nowMs?: number
  pickSurface?: WlsPickSurface
}): Promise<WlsProductSelection[]> {
  const pickSurface = input.pickSurface ?? "story"
  const ids = input.marketingEntityIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) return []

  const { data, error } = await input.supabase
    .from("marketing_entities")
    .select(MARKETING_ENTITY_SELECT)
    .eq("entity_id", input.entityId)
    .in("id", ids)

  if (error) {
    throw new Error(error.message)
  }

  const options: WlsEligibilityOptions = {
    entityId: input.entityId,
    websiteUrl: input.websiteUrl,
    template: input.template,
    reuseCooldownMs: input.reuseCooldownMs,
    nowMs: input.nowMs,
  }

  const byId = new Map<string, WlsProductSelection>()
  for (const row of data ?? []) {
    const item = mapMarketingEntityRow(row)
    const selection = evaluateWlsProductEligibility(item, options)
    byId.set(selection.marketingEntityId, selection)
  }

  const ordered: WlsProductSelection[] = []
  for (const id of ids) {
    const selection = byId.get(id)
    if (!selection) {
      throw new Error(`Synced product not found on this brand (${id.slice(0, 8)}…).`)
    }
    const ok =
      pickSurface === "feed"
        ? selection.feedSelectable
        : selection.storySelectable
    if (!ok) {
      const blockers =
        pickSurface === "feed"
          ? selection.hardBlockers
          : selection.storyHardBlockers
      const reason = blockers[0]
        ? ownerLabelForHardBlock(blockers[0])
        : pickSurface === "feed"
          ? "not available for Feed"
          : "not available for Story"
      throw new Error(
        `${selection.brand || selection.title}: ${reason} — pick another product.`
      )
    }
    ordered.push(selection)
  }

  return ordered
}
