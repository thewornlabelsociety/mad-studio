import assert from "node:assert/strict"
import { test } from "node:test"

import type { MarketingEntity } from "./types.ts"
import {
  evaluateWlsProductEligibility,
  ownerLabelForHardBlock,
} from "./wls-product-eligibility.ts"
import { mapNewArrivalSuggestions } from "../studio/new-arrival-suggestions.ts"

const ENTITY_ID = "ff62adda-3c81-421a-9c9a-e817d4169f74"
const WEBSITE = "https://www.wornlabelsociety.co.nz"
const NOW = Date.parse("2026-10-24T00:00:00.000Z")

function baseItem(overrides: Partial<MarketingEntity> = {}): MarketingEntity {
  return {
    id: "me-1",
    entity_id: ENTITY_ID,
    website_item_id: "wls-100",
    title: "Zimmermann Linen Midi",
    brand: "Zimmermann",
    price: 890,
    description: "Brand: Zimmermann · Size: 1",
    images: ["https://cdn.example.com/garment.jpg"],
    status: "unfeatured",
    metrics: { views: 0, clicks: 0, sales: 0 },
    listing_availability: "available",
    listing_synced_at: "2026-10-23T00:00:00.000Z",
    listing_size: "1",
    listing_currency: "NZD",
    listing_url:
      "https://www.wornlabelsociety.co.nz/marketplace/listings/wls-100",
    vibe: null,
    aesthetic_slugs: [],
    scheduled_at: null,
    channels: [],
    copy_draft: {},
    published_media_ids: {},
    trackable_slug: null,
    published_at: null,
    created_at: "2026-10-20T00:00:00.000Z",
    updated_at: "2026-10-23T00:00:00.000Z",
    ...overrides,
  }
}

const evalOpts = {
  entityId: ENTITY_ID,
  websiteUrl: WEBSITE,
  template: "daily_story" as const,
  nowMs: NOW,
}

/** Same minimum fields the Synced Products strip requires for Story handoff. */
function hasRequiredListingForStrip(item: MarketingEntity): boolean {
  return Boolean(
    item.website_item_id?.trim() &&
      item.title?.trim() &&
      item.images.some((url) => /^https?:\/\//i.test(url.trim()) || url.trim().startsWith("//"))
  )
}

test("acceptance: every Suggested New Arrivals row with required listing is strip-selectable", () => {
  const pool = [
    baseItem(),
    baseItem({
      id: "me-2",
      listing_size: null,
      description: "Brand: Zimmermann",
    }),
    baseItem({
      id: "me-3",
      price: null,
    }),
    baseItem({
      id: "me-4",
      status: "draft",
    }),
  ]

  const suggestions = mapNewArrivalSuggestions({
    items: pool,
    brandName: "Worn Label Society",
    isFashion: true,
  })

  assert.ok(suggestions.length >= 3, "expected multiple suggestion rows")

  for (const row of suggestions) {
    if (!hasRequiredListingForStrip(row.item)) continue
    const selection = evaluateWlsProductEligibility(row.item, evalOpts)
    assert.equal(
      selection.feedSelectable,
      true,
      `New Arrival "${row.item.title}" blocked: ${selection.hardBlockers.map(ownerLabelForHardBlock).join(", ")}`
    )
  }
})

test("acceptance 1: previously featured (published) but available is strip-selectable", () => {
  const selection = evaluateWlsProductEligibility(
    baseItem({
      status: "published",
      published_at: "2026-10-20T00:00:00.000Z",
    }),
    evalOpts
  )
  assert.equal(selection.selectable, true)
  assert.ok(selection.softWarnings.includes("featured_recently"))
})

test("acceptance 2: no verified AU size — selectable, size stays null", () => {
  const selection = evaluateWlsProductEligibility(
    baseItem({ listing_size: null, description: "Brand: Zimmermann" }),
    evalOpts
  )
  assert.equal(selection.selectable, true)
  assert.equal(selection.size, null)
  assert.ok(selection.softWarnings.includes("no_verified_size"))
})

test("acceptance 3: sold listing is not selectable", () => {
  const selection = evaluateWlsProductEligibility(
    baseItem({ listing_availability: "sold" }),
    evalOpts
  )
  assert.equal(selection.selectable, false)
  assert.ok(selection.hardBlockers.includes("not_available"))
})

test("acceptance: missing shop link allows Feed but blocks Story", () => {
  const suggestions = mapNewArrivalSuggestions({
    items: [
      baseItem({
        website_item_id: "ig-no-link",
        listing_url: null,
      }),
    ],
    brandName: "Worn Label Society",
    isFashion: true,
  })
  assert.equal(suggestions.length, 1)
  const selection = evaluateWlsProductEligibility(
    suggestions[0].item,
    { ...evalOpts, websiteUrl: null }
  )
  assert.equal(selection.feedSelectable, true)
  assert.equal(selection.storySelectable, false)
  assert.ok(selection.storyHardBlockers.includes("missing_shop_link"))
})
