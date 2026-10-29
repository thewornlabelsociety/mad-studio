import type { IntakeCaptionDefaultSource } from "./intake-caption-default.ts"
import { buildSeededCopyDraft } from "./intake-caption-default.ts"
import type { ListingAvailability } from "./listing-availability.ts"
import { withListingSyncMetrics } from "./listing-availability.ts"
import { withListingGarmentMetrics } from "./listing-garment.ts"
import { withListingVibeMetrics } from "./listing-vibe.ts"

/** Incoming catalogue row used to reconcile marketing_entities. */
export type ArrivalReconcileInput = {
  website_item_id: string
  title: string
  brand: string | null
  price: number | null
  currency: string | null
  size: string | null
  description: string | null
  images: string[]
  vibe: string | null
  aesthetic_slugs: string[]
  /** Marketplace category and gender; left out by feeds that have none. */
  category?: string | null
  gender?: string | null
  availability: ListingAvailability
  listing_url: string | null
}

export type ExistingArrivalRow = {
  id: string
  title: string
  brand: string | null
  price: number | null
  description: string | null
  images: string[] | null
  metrics: unknown
}

export type ArrivalReconcilePatch = {
  title?: string
  brand?: string | null
  price?: number | null
  description?: string | null
  images?: string[]
  metrics: Record<string, unknown>
  updated_at: string
}

function asMetricsRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return { views: 0, clicks: 0, sales: 0 }
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function imagesChanged(existing: string[], incoming: string[]): boolean {
  if (incoming.length === 0) return false
  if (existing.length !== incoming.length) return true
  return existing.some((url, index) => url !== incoming[index])
}

/**
 * Build an update patch that refreshes authoritative catalogue fields without
 * clobbering valid local values with empty/uncertain upstream data.
 * Never touches copy_draft, status, channels, or published media.
 */
export function buildArrivalReconcilePatch(input: {
  existing: ExistingArrivalRow
  incoming: ArrivalReconcileInput
  syncedAt: string
}): { patch: ArrivalReconcilePatch; changed: boolean } {
  const existingImages = Array.isArray(input.existing.images)
    ? input.existing.images
    : []
  const patch: ArrivalReconcilePatch = {
    metrics: asMetricsRecord(input.existing.metrics),
    updated_at: input.syncedAt,
  }
  let changed = false

  if (hasText(input.incoming.title) && input.incoming.title !== input.existing.title) {
    patch.title = input.incoming.title.slice(0, 500)
    changed = true
  }

  if (
    hasText(input.incoming.brand) &&
    input.incoming.brand !== (input.existing.brand ?? null)
  ) {
    patch.brand = input.incoming.brand
    changed = true
  }

  if (
    input.incoming.price != null &&
    Number.isFinite(input.incoming.price) &&
    input.incoming.price !==
      (input.existing.price == null ? null : Number(input.existing.price))
  ) {
    patch.price = input.incoming.price
    changed = true
  }

  if (
    hasText(input.incoming.description) &&
    input.incoming.description !== (input.existing.description ?? null)
  ) {
    patch.description = input.incoming.description
    changed = true
  }

  if (
    input.incoming.images.length > 0 &&
    imagesChanged(existingImages, input.incoming.images)
  ) {
    patch.images = input.incoming.images.slice(0, 12)
    changed = true
  }

  let metrics = withListingVibeMetrics(patch.metrics, {
    vibe: input.incoming.vibe,
    aesthetic_slugs: input.incoming.aesthetic_slugs,
  })
  if (input.incoming.category !== undefined || input.incoming.gender !== undefined) {
    metrics = withListingGarmentMetrics(metrics, {
      category: input.incoming.category,
      gender: input.incoming.gender,
    })
  }
  metrics = withListingSyncMetrics(metrics, {
    availability: input.incoming.availability,
    syncedAt: input.syncedAt,
    size: input.incoming.size,
    currency: input.incoming.currency,
    listingUrl: input.incoming.listing_url,
  })

  const prev = JSON.stringify(asMetricsRecord(input.existing.metrics))
  const next = JSON.stringify(metrics)
  if (prev !== next) {
    changed = true
  }
  patch.metrics = metrics

  return { patch, changed }
}

export function buildArrivalInsertRow(input: {
  entityId: string
  incoming: ArrivalReconcileInput
  syncedAt: string
  intakeCaptionDefault?: IntakeCaptionDefaultSource
}): Record<string, unknown> {
  const metrics = withListingSyncMetrics(
    withListingGarmentMetrics(
      withListingVibeMetrics(
        { views: 0, clicks: 0, sales: 0 },
        {
          vibe: input.incoming.vibe,
          aesthetic_slugs: input.incoming.aesthetic_slugs,
        }
      ),
      { category: input.incoming.category, gender: input.incoming.gender }
    ),
    {
      availability: input.incoming.availability,
      syncedAt: input.syncedAt,
      size: input.incoming.size,
      currency: input.incoming.currency ?? "NZD",
      listingUrl: input.incoming.listing_url,
    }
  )

  const source = input.intakeCaptionDefault ?? "listing_description"

  return {
    entity_id: input.entityId,
    website_item_id: input.incoming.website_item_id,
    title: input.incoming.title.slice(0, 500),
    brand: input.incoming.brand,
    price: input.incoming.price,
    description: input.incoming.description,
    images: input.incoming.images.slice(0, 12),
    status: "unfeatured",
    copy_draft: buildSeededCopyDraft({
      source,
      title: input.incoming.title,
      brand: input.incoming.brand,
      description: input.incoming.description,
      syncedAt: input.syncedAt,
    }),
    metrics,
    updated_at: input.syncedAt,
  }
}
