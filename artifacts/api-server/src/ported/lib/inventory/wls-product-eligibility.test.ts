import assert from "node:assert/strict"
import { test } from "node:test"

import { classifyWornLabelAvailability } from "./listing-availability.ts"
import { buildArrivalReconcilePatch } from "./reconcile-arrival.ts"
import { parseCopyDraft, parseCopyDraftMetadata } from "./types.ts"
import type { MarketingEntity } from "./types.ts"
import {
  evaluateWlsProductEligibility,
  ownerLabelForHardBlock,
  resolveWlsMarketingLifecycle,
} from "./wls-product-eligibility.ts"

const ENTITY_ID = "ff62adda-3c81-421a-9c9a-e817d4169f74"
const WEBSITE = "https://www.wornlabelsociety.co.nz"
const NOW = Date.parse("2026-10-23T00:00:00.000Z")

function baseItem(overrides: Partial<MarketingEntity> = {}): MarketingEntity {
  return {
    id: "me-1",
    entity_id: ENTITY_ID,
    website_item_id: "wls-100",
    title: "Zimmermann Linen Midi",
    brand: "Zimmermann",
    price: 890,
    description: "Brand: Zimmermann · Size: 1",
    images: [
      "https://cdn.example.com/garment.jpg",
    ],
    status: "unfeatured",
    metrics: { views: 0, clicks: 0, sales: 0 },
    listing_availability: "available",
    listing_synced_at: "2026-10-23T00:00:00.000Z",
    listing_size: "1",
    listing_currency: "NZD",
    listing_url: "https://www.wornlabelsociety.co.nz/marketplace/listings/wls-100",
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

const opts = {
  entityId: ENTITY_ID,
  websiteUrl: WEBSITE,
  template: "daily_story" as const,
  nowMs: NOW,
}

test("1. new published available listing is selectable", () => {
  const result = evaluateWlsProductEligibility(baseItem(), opts)
  assert.equal(result.selectable, true)
  assert.equal(result.eligible, true)
  assert.deepEqual(result.hardBlockers, [])
  assert.equal(result.websiteItemId, "wls-100")
  assert.equal(result.size, "1")
  assert.equal(result.usage.lifecycle, "synced")
})

test("2. existing listing price refresh via reconcile patch", () => {
  const { patch, changed } = buildArrivalReconcilePatch({
    existing: {
      id: "me-1",
      title: "Zimmermann Linen Midi",
      brand: "Zimmermann",
      price: 890,
      description: "Brand: Zimmermann · Size: 1",
      images: ["https://cdn.example.com/garment.jpg"],
      metrics: {
        views: 1,
        clicks: 0,
        sales: 0,
        listing_availability: "available",
      },
    },
    incoming: {
      website_item_id: "wls-100",
      title: "Zimmermann Linen Midi",
      brand: "Zimmermann",
      price: 720,
      currency: "NZD",
      size: "1",
      description: "Brand: Zimmermann · Size: 1",
      images: ["https://cdn.example.com/garment.jpg"],
      vibe: null,
      aesthetic_slugs: [],
      availability: "available",
      listing_url:
        "https://www.wornlabelsociety.co.nz/marketplace/listings/wls-100",
    },
    syncedAt: "2026-10-23T12:00:00.000Z",
  })

  assert.equal(changed, true)
  assert.equal(patch.price, 720)
  assert.equal(patch.metrics.listing_availability, "available")
  assert.equal("copy_draft" in patch, false)
})

test("3. sold listing is hard blocked", () => {
  assert.equal(
    classifyWornLabelAvailability({ status: "sold", isSold: true }),
    "sold"
  )
  const result = evaluateWlsProductEligibility(
    baseItem({ listing_availability: "sold" }),
    opts
  )
  assert.equal(result.selectable, false)
  assert.ok(result.hardBlockers.includes("not_available"))
  assert.equal(result.availabilityBadge, "sold")
})

test("4. unknown availability without catalogue id is soft warning only", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({
      listing_availability: "unknown",
      website_item_id: "",
      status: "published",
    }),
    opts
  )
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("check_stock"))
  assert.equal(result.availabilityBadge, "verify")
})

test("5. missing image is hard blocked", () => {
  const result = evaluateWlsProductEligibility(baseItem({ images: [] }), opts)
  assert.equal(result.selectable, false)
  assert.ok(result.hardBlockers.includes("missing_image"))
})

test("6. missing size is soft warning only", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({
      listing_size: null,
      description: "Brand: Zimmermann",
      copy_draft: {},
    }),
    opts
  )
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("no_verified_size"))
  assert.equal(result.size, null)
})

test("7. missing price is soft warning — still selectable", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({ price: null }),
    opts
  )
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("missing_price"))
})

test("7b. published within cooldown is soft warning — still selectable", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({
      status: "published",
      published_at: "2026-10-20T00:00:00.000Z",
    }),
    { ...opts, reuseCooldownMs: 14 * 24 * 60 * 60 * 1000 }
  )
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("featured_recently"))
})

test("8. studio_used_at is soft used_before", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({
      copy_draft: {
        metadata: { studio_used_at: "2026-10-20T00:00:00.000Z" },
      },
    }),
    opts
  )
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("used_before"))
})

test("9. draft status is selectable with creative_in_progress hint", () => {
  const item = baseItem({ status: "draft" })
  assert.equal(resolveWlsMarketingLifecycle(item), "drafted")
  const result = evaluateWlsProductEligibility(item, opts)
  assert.equal(result.selectable, true)
  assert.ok(result.softWarnings.includes("creative_in_progress"))
})

test("10. scheduled status is hard blocked (queued_for_publish)", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({ status: "scheduled" }),
    opts
  )
  assert.equal(result.selectable, false)
  assert.ok(result.hardBlockers.includes("queued_for_publish"))
  assert.equal(
    ownerLabelForHardBlock("queued_for_publish"),
    "already queued to post"
  )
})

test("11. missing shop link hard blocks daily story template", () => {
  const result = evaluateWlsProductEligibility(
    baseItem({
      website_item_id: "ig-no-link",
      listing_url: null,
    }),
    { ...opts, websiteUrl: null }
  )
  assert.equal(result.selectable, false)
  assert.ok(result.hardBlockers.includes("missing_shop_link"))
})

test("copy_draft metadata round-trips studio_used_at and deck dismiss", () => {
  const parsed = parseCopyDraft({
    caption: "hello",
    metadata: {
      studio_used_at: "2026-10-21T00:00:00.000Z",
      today_deck_status: "archived",
      today_deck_dismissed_at: "2026-10-21T01:00:00.000Z",
      target_url: "https://example.com/x",
    },
  })
  assert.equal(parsed.metadata?.studio_used_at, "2026-10-21T00:00:00.000Z")
  assert.equal(parsed.metadata?.today_deck_status, "archived")
  assert.equal(
    parsed.metadata?.today_deck_dismissed_at,
    "2026-10-21T01:00:00.000Z"
  )

  const metaOnly = parseCopyDraftMetadata({
    studio_used_at: "2026-10-21T00:00:00.000Z",
  })
  assert.equal(metaOnly?.studio_used_at, "2026-10-21T00:00:00.000Z")
})
