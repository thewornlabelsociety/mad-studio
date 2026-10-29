/** A shop markdown: the full price before the discount, and when it started. */
export type ListingMarkdown = {
  wasPrice: number | null
  discountedAt: string | null
}

/** Full price only when the listing is actually discounted below it. */
export function markdownFromPrices(input: {
  fullPrice: number | null | undefined
  salePrice: number | null | undefined
  discountedAt?: string | null
}): ListingMarkdown {
  const full = input.fullPrice
  const sale = input.salePrice
  if (full == null || sale == null || !Number.isFinite(full) || !Number.isFinite(sale) || sale >= full) {
    return { wasPrice: null, discountedAt: null }
  }
  return { wasPrice: full, discountedAt: input.discountedAt?.trim() || null }
}

export function readListingMarkdownFromMetrics(metrics: unknown): ListingMarkdown {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return { wasPrice: null, discountedAt: null }
  }
  const record = metrics as Record<string, unknown>
  const was = Number(record.listing_was_price)
  return {
    wasPrice: record.listing_was_price != null && Number.isFinite(was) ? was : null,
    discountedAt:
      typeof record.listing_discounted_at === "string" ? record.listing_discounted_at : null,
  }
}

export function withListingMarkdownMetrics(
  metrics: Record<string, unknown>,
  input: ListingMarkdown
): Record<string, unknown> {
  const next = { ...metrics }
  if (input.wasPrice != null) next.listing_was_price = input.wasPrice
  else delete next.listing_was_price
  if (input.wasPrice != null && input.discountedAt) next.listing_discounted_at = input.discountedAt
  else delete next.listing_discounted_at
  return next
}

/** Whole-number percent off, e.g. 40 for $80 → $48. */
export function percentOff(wasPrice: number, price: number): number {
  if (wasPrice <= 0) return 0
  return Math.round(((wasPrice - price) / wasPrice) * 100)
}
