import assert from "node:assert/strict"
import { test } from "node:test"

import { markdownFromPrices, percentOff, readListingMarkdownFromMetrics } from "./listing-markdown.ts"
import { buildArrivalInsertRow, buildArrivalReconcilePatch } from "./reconcile-arrival.ts"

const base = {
  website_item_id: "w1",
  title: "Shirt Kana Maru in Cream",
  brand: "Kana Maru",
  price: 45,
  currency: "NZD",
  size: "M",
  description: null,
  images: ["https://example.com/a.jpg"],
  vibe: null,
  aesthetic_slugs: [],
  availability: "available" as const,
  listing_url: null,
}

test("only a real discount counts as a markdown", () => {
  assert.deepEqual(markdownFromPrices({ fullPrice: 80, salePrice: 45, discountedAt: "2026-10-28" }), {
    wasPrice: 80,
    discountedAt: "2026-10-28",
  })
  assert.equal(markdownFromPrices({ fullPrice: 45, salePrice: 45 }).wasPrice, null)
  assert.equal(markdownFromPrices({ fullPrice: 45, salePrice: null }).wasPrice, null)
  assert.equal(percentOff(80, 48), 40)
})

test("a marked-down arrival keeps its full price", () => {
  const row = buildArrivalInsertRow({
    entityId: "e",
    incoming: { ...base, markdown: { wasPrice: 80, discountedAt: "2026-10-28" } },
    syncedAt: "2026-10-29T00:00:00Z",
  })
  assert.deepEqual(readListingMarkdownFromMetrics(row.metrics), { wasPrice: 80, discountedAt: "2026-10-28" })
})

test("a markdown that ends is cleared on the next sync", () => {
  const { patch } = buildArrivalReconcilePatch({
    existing: {
      id: "m1",
      title: base.title,
      brand: base.brand,
      price: 45,
      description: null,
      images: base.images,
      metrics: { listing_was_price: 80, listing_discounted_at: "2026-10-28" },
    },
    incoming: { ...base, markdown: { wasPrice: null, discountedAt: null } },
    syncedAt: "2026-10-29T00:00:00Z",
  })
  assert.deepEqual(readListingMarkdownFromMetrics(patch.metrics), { wasPrice: null, discountedAt: null })
})
