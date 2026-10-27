import assert from "node:assert/strict"
import { test } from "node:test"

import type { WlsProductSelection } from "@/lib/inventory/wls-product-eligibility"
import {
  filterWlsStripCatalog,
  isWlsFreshDrop,
  matchesWlsStripFilter,
} from "@/lib/studio/wls-strip-catalog"
import { suggestFormatForWlsSelection } from "@/lib/studio/wls-strip-format"

function row(
  overrides: Partial<WlsProductSelection> = {}
): WlsProductSelection {
  return {
    marketingEntityId: "me-1",
    websiteItemId: "wls-1",
    entityId: "ent-1",
    brand: "Zimmermann",
    title: "Dress",
    description: null,
    size: "1",
    price: 100,
    currency: "NZD",
    sourceImageUrls: ["https://cdn.example.com/a.jpg"],
    destinationUrl: "https://www.wornlabelsociety.co.nz/marketplace/listings/wls-1",
    availability: "available",
    lastSyncedAt: null,
    usage: {
      marketingStatus: "unfeatured",
      lifecycle: "synced",
      studioUsedAt: null,
      todayDeckStatus: null,
      todayDeckDismissedAt: null,
      publishedAt: null,
    },
    feedSelectable: true,
    storySelectable: true,
    selectable: true,
    eligible: true,
    hardBlockers: [],
    storyHardBlockers: [],
    softWarnings: [],
    availabilityBadge: "in_stock",
    exclusionReasons: [],
    template: "daily_story",
    ...overrides,
  }
}

test("fresh drops mirror New Arrivals semantics", () => {
  assert.equal(isWlsFreshDrop(row()), true)
  assert.equal(
    isWlsFreshDrop(
      row({
        usage: {
          ...row().usage,
          studioUsedAt: "2026-10-01T00:00:00.000Z",
        },
      })
    ),
    false
  )
  assert.equal(
    matchesWlsStripFilter(
      row({ usage: { ...row().usage, marketingStatus: "published" } }),
      "fresh_drops"
    ),
    false
  )
})

test("previously posted filter includes published rows", () => {
  assert.equal(
    matchesWlsStripFilter(
      row({
        usage: { ...row().usage, marketingStatus: "published" },
        softWarnings: ["featured_recently"],
      }),
      "previously_posted"
    ),
    true
  )
})

test("search matches brand or title", () => {
  const filtered = filterWlsStripCatalog({
    catalog: [
      row({ brand: "Zimmermann", title: "Linen" }),
      row({ marketingEntityId: "me-2", brand: "Scanlan", title: "Silk" }),
    ],
    filter: "all_available",
    searchQuery: "scan",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].brand, "Scanlan")
})

test("format hint uses shared suggestFormat logic", () => {
  const hint = suggestFormatForWlsSelection(
    row({
      sourceImageUrls: [
        "https://cdn.example.com/1.jpg",
        "https://cdn.example.com/2.jpg",
        "https://cdn.example.com/3.jpg",
      ],
    })
  )
  assert.equal(hint.format, "carousel")
  assert.equal(hint.label, "Carousel")
})
