import assert from "node:assert/strict"
import { test } from "node:test"

import {
  categoryFromDescription,
  garmentGender,
  listingGenderField,
  normalizeGarmentGender,
  readListingGarmentFromMetrics,
} from "./listing-garment.ts"
import { buildArrivalInsertRow, buildArrivalReconcilePatch } from "./reconcile-arrival.ts"

const incoming = {
  website_item_id: "w1",
  title: "Blouse Tigerlily in White",
  brand: "Tigerlily",
  price: 30,
  currency: "NZD",
  size: "10",
  description: "Brand: Tigerlily\nTops",
  images: ["https://example.com/a.jpg"],
  vibe: null,
  aesthetic_slugs: [],
  category: "Tops",
  gender: "Women",
  availability: "available" as const,
  listing_url: null,
}

test("a new arrival keeps the shop's category and gender", () => {
  const row = buildArrivalInsertRow({ entityId: "e", incoming, syncedAt: "2026-10-29T00:00:00Z" })
  assert.deepEqual(readListingGarmentFromMetrics(row.metrics), { category: "Tops", gender: "women" })
})

test("re-syncing an older item adds category and gender", () => {
  const { patch, changed } = buildArrivalReconcilePatch({
    existing: {
      id: "m1",
      title: incoming.title,
      brand: incoming.brand,
      price: 30,
      description: incoming.description,
      images: incoming.images,
      metrics: { views: 0, clicks: 0, sales: 0 },
    },
    incoming,
    syncedAt: "2026-10-29T00:00:00Z",
  })
  assert.equal(changed, true)
  assert.deepEqual(readListingGarmentFromMetrics(patch.metrics), { category: "Tops", gender: "women" })
})

test("feeds without category or gender leave saved values alone", () => {
  const { patch } = buildArrivalReconcilePatch({
    existing: {
      id: "m1",
      title: incoming.title,
      brand: incoming.brand,
      price: 30,
      description: incoming.description,
      images: incoming.images,
      metrics: { listing_category: "Tops", listing_gender: "women" },
    },
    incoming: { ...incoming, category: undefined, gender: undefined },
    syncedAt: "2026-10-29T00:00:00Z",
  })
  assert.deepEqual(readListingGarmentFromMetrics(patch.metrics), { category: "Tops", gender: "women" })
})

test("older items fall back to the description's category line and title words", () => {
  assert.equal(categoryFromDescription("Brand: X\nSize: M\nBottoms\nBlue"), "Bottoms")
  assert.equal(garmentGender({ title: "Shirt Coco Mens in Navy" }), "men")
  assert.equal(garmentGender({ title: "Shirt Coco in Navy" }), null)
})

test("children are split by the shop's age group: baby, kids, tween", () => {
  assert.equal(listingGenderField("Boys", "Baby"), "baby")
  assert.equal(listingGenderField("Men", "Teen"), "tween")
  assert.equal(listingGenderField("Girls", "Kids"), "kids")
  assert.equal(listingGenderField("Men", "Adult"), "Men")
  assert.equal(normalizeGarmentGender("baby"), "baby")
  assert.equal(normalizeGarmentGender("tween"), "tween")
  assert.equal(normalizeGarmentGender("Boys"), "kids")
  assert.equal(normalizeGarmentGender("Women"), "women")
  assert.equal(garmentGender({ title: "Boys Puffer Jacket" }), "kids")
  // A colour, not an age.
  assert.equal(garmentGender({ title: "Mini Dress Staple the Label in Baby blue" }), null)
})
