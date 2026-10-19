type ArrivalLike = {
  website_item_id?: string | null
  created_at?: string | null
}

const NUMERIC_ID = /^\d+$/

/**
 * Newest stock first. Worn Label's website numbers items as they're added
 * to the shop, so a higher number is a newer arrival — even when it was
 * imported into Studio in an earlier batch. Anything without a shop number
 * (FÜDI posts, phone drops) falls back to when it came into Studio.
 */
export function compareNewestArrival(a: ArrivalLike, b: ArrivalLike): number {
  const aId = a.website_item_id?.trim() ?? ""
  const bId = b.website_item_id?.trim() ?? ""
  if (NUMERIC_ID.test(aId) && NUMERIC_ID.test(bId)) {
    const diff = Number(bId) - Number(aId)
    if (diff !== 0) return diff
  }
  return (b.created_at ?? "").localeCompare(a.created_at ?? "")
}
