/**
 * Listing availability + sync metadata stored on marketing_entities.metrics.
 * No schema migration — keeps source listing state separate from creative drafts.
 */

export const LISTING_AVAILABILITIES = [
  "available",
  "sold",
  "unavailable",
  "unknown",
] as const

export type ListingAvailability = (typeof LISTING_AVAILABILITIES)[number]

const WLS_LIVE_STATUSES = new Set(["active", "available", "published", "live"])
const WLS_SOLD_STATUSES = new Set([
  "sold",
  "sold_out",
  "soldout",
  "unavailable",
  "delisted",
  "expired",
  "archived",
  "removed",
])

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return null
}

function booleanField(
  record: Record<string, unknown>,
  ...keys: string[]
): boolean {
  for (const key of keys) {
    const value = record[key]
    if (value === true) return true
    if (value === false) return false
    if (value === 1 || value === "1" || value === "true") return true
  }
  return false
}

/** Classify WLS storefront JSON into a conservative availability state. */
export function classifyWornLabelAvailability(
  record: Record<string, unknown>
): ListingAvailability {
  if (
    booleanField(record, "isSold", "is_sold", "sold", "soldOut", "sold_out")
  ) {
    return "sold"
  }

  if (stringField(record, "soldAt", "sold_at")) {
    return "sold"
  }

  if (stringField(record, "delistedAt", "delisted_at")) {
    return "unavailable"
  }

  const expiresAt = stringField(record, "expiresAt", "expires_at")
  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt)
    if (Number.isFinite(expiresMs) && expiresMs < Date.now()) {
      return "unavailable"
    }
  }

  const status = stringField(
    record,
    "status",
    "listingStatus",
    "listing_status"
  )?.toLowerCase()

  if (status) {
    if (WLS_SOLD_STATUSES.has(status)) {
      return status === "sold" || status === "sold_out" || status === "soldout"
        ? "sold"
        : "unavailable"
    }
    if (WLS_LIVE_STATUSES.has(status)) return "available"
    // Unknown status string — do not treat as available.
    return "unknown"
  }

  // No status and no sold signals: treat as available (live catalogue row).
  return "available"
}

export function isListingAvailableForSale(
  availability: ListingAvailability
): boolean {
  return availability === "available"
}

export function readListingAvailability(
  metrics: unknown
): ListingAvailability {
  const record = asRecord(metrics)
  const raw = record?.listing_availability
  if (
    typeof raw === "string" &&
    (LISTING_AVAILABILITIES as readonly string[]).includes(raw)
  ) {
    return raw as ListingAvailability
  }
  return "unknown"
}

export function readListingSyncedAt(metrics: unknown): string | null {
  const record = asRecord(metrics)
  const raw = record?.listing_synced_at
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

/** Explicit size from the source listing — never a title heuristic. */
export function readVerifiedListingSize(metrics: unknown): string | null {
  const record = asRecord(metrics)
  const raw = record?.listing_size
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

export function readListingCurrency(metrics: unknown): string {
  const record = asRecord(metrics)
  const raw = record?.listing_currency
  if (typeof raw === "string" && raw.trim()) return raw.trim().toUpperCase()
  return "NZD"
}

export function readListingUrl(metrics: unknown): string | null {
  const record = asRecord(metrics)
  const raw = record?.listing_url
  if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) {
    return raw.trim()
  }
  return null
}

export function withListingSyncMetrics(
  metrics: Record<string, unknown>,
  input: {
    availability: ListingAvailability
    syncedAt: string
    size?: string | null
    currency?: string | null
    listingUrl?: string | null
  }
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...metrics,
    listing_availability: input.availability,
    listing_synced_at: input.syncedAt,
  }

  if (input.size?.trim()) {
    next.listing_size = input.size.trim()
  }
  // Do not clear a previously verified size when upstream omits size.

  if (input.currency?.trim()) {
    next.listing_currency = input.currency.trim().toUpperCase()
  }

  if (input.listingUrl && /^https?:\/\//i.test(input.listingUrl.trim())) {
    next.listing_url = input.listingUrl.trim()
  }

  return next
}
