import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"

export type WlsStripCatalogFilter =
  | "all_available"
  | "fresh_drops"
  | "not_featured"
  | "previously_posted"

export const WLS_STRIP_FILTER_LABELS: Record<WlsStripCatalogFilter, string> = {
  all_available: "All available",
  fresh_drops: "Fresh drops",
  not_featured: "Not featured",
  previously_posted: "Previously posted",
}

/** Same rules as Suggested New Arrivals (filterNewArrivalCatalogItems). */
export function isWlsFreshDrop(row: WlsProductSelection): boolean {
  if (row.usage.marketingStatus !== "unfeatured") return false
  if (
    row.usage.todayDeckStatus === "skipped" ||
    row.usage.todayDeckStatus === "archived"
  ) {
    return false
  }
  if (row.usage.studioUsedAt) return false
  return row.feedSelectable
}

export function matchesWlsStripFilter(
  row: WlsProductSelection,
  filter: WlsStripCatalogFilter
): boolean {
  switch (filter) {
    case "all_available":
      return row.feedSelectable
    case "fresh_drops":
      return isWlsFreshDrop(row)
    case "not_featured":
      return row.usage.marketingStatus === "unfeatured"
    case "previously_posted":
      return (
        row.usage.marketingStatus === "published" ||
        Boolean(row.usage.publishedAt) ||
        row.softWarnings.includes("featured_recently")
      )
    default:
      return true
  }
}

export function searchWlsStripCatalog(
  catalog: WlsProductSelection[],
  query: string
): WlsProductSelection[] {
  const q = query.trim().toLowerCase()
  if (!q) return catalog
  return catalog.filter((row) => {
    const brand = row.brand?.trim().toLowerCase() ?? ""
    const title = row.title.trim().toLowerCase()
    return brand.includes(q) || title.includes(q)
  })
}

export function filterWlsStripCatalog(input: {
  catalog: WlsProductSelection[]
  filter: WlsStripCatalogFilter
  searchQuery?: string
}): WlsProductSelection[] {
  const searched = searchWlsStripCatalog(
    input.catalog,
    input.searchQuery ?? ""
  )
  return searched.filter((row) => matchesWlsStripFilter(row, input.filter))
}
