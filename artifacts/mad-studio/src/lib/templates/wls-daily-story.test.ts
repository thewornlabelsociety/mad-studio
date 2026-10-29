import assert from "node:assert/strict"
import { test } from "node:test"

import type { WlsProductSelection } from "../inventory/wls-product-eligibility.ts"
import {
  assertWlsDailyStoryRenderable,
  buildWlsDailyStoryCanvasModel,
  buildWlsDailyStoryDraftMeta,
  buildWlsDailyStoryGenerationKey,
  isWornLabelFashionEntity,
  readWlsDailyStoryDraftMeta,
  WLS_DAILY_STORY_EXPORT,
  WLS_DAILY_STORY_TEMPLATE_NAME,
} from "./wls-daily-story.ts"

const ENTITY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

function selection(
  overrides: Partial<WlsProductSelection> = {}
): WlsProductSelection {
  return {
    marketingEntityId: "me-1",
    websiteItemId: "wls-42",
    entityId: ENTITY,
    brand: "Zimmermann",
    title: "Linen Midi Dress",
    description: "Brand: Zimmermann · Size: 1",
    size: "1",
    price: 890,
    currency: "NZD",
    sourceImageUrls: ["https://cdn.example.com/dress.jpg"],
    destinationUrl:
      "https://www.wornlabelsociety.co.nz/marketplace/listings/wls-42",
    availability: "available",
    lastSyncedAt: "2026-10-23T00:00:00.000Z",
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

test("template name and export size are fixed", () => {
  assert.equal(WLS_DAILY_STORY_TEMPLATE_NAME, "WLS — Daily New Arrival Story")
  assert.equal(WLS_DAILY_STORY_EXPORT.width, 1080)
  assert.equal(WLS_DAILY_STORY_EXPORT.height, 1920)
})

test("fashion entity gate uses name, not hardcoded UUID", () => {
  assert.equal(
    isWornLabelFashionEntity({ name: "Worn Label Society" }),
    true
  )
  assert.equal(isWornLabelFashionEntity({ name: "FÜDI Tap" }), false)
})

test("canvas model includes brand, title, price; omits missing size", () => {
  const withSize = buildWlsDailyStoryCanvasModel({
    selection: selection(),
    brandName: "Worn Label Society",
    imageUrl: "https://cdn.example.com/dress.jpg",
  })
  assert.match(withSize.specsLine, /ZIMMERMANN/)
  assert.match(withSize.specsLine, /\$890/)
  assert.match(withSize.specsLine, /SIZE 1/)
  assert.equal(withSize.imageUrl, "https://cdn.example.com/dress.jpg")
  assert.equal(withSize.category, "New Arrival")

  const noSize = buildWlsDailyStoryCanvasModel({
    selection: selection({ size: null }),
    brandName: "Worn Label Society",
    imageUrl: "https://cdn.example.com/dress.jpg",
  })
  assert.equal(noSize.sizeLabel, null)
  assert.equal(noSize.specsLine.includes("SZ "), false)
  assert.match(noSize.specsLine, /\$890/)
})

test("sold and unavailable products are rejected", () => {
  const sold = assertWlsDailyStoryRenderable({
    selection: selection({
      feedSelectable: false,
      storySelectable: false,
      selectable: false,
      eligible: false,
      hardBlockers: ["not_available"],
      storyHardBlockers: ["not_available"],
      exclusionReasons: ["not_available"],
      availability: "sold",
      availabilityBadge: "sold",
    }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
  })
  assert.equal(sold.ok, false)
  if (!sold.ok) assert.equal(sold.reason, "not_available")

  const verifyStock = assertWlsDailyStoryRenderable({
    selection: selection({
      availability: "unknown",
      availabilityBadge: "verify",
      softWarnings: ["check_stock"],
    }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
  })
  assert.equal(verifyStock.ok, true)
})

test("cross-entity access is rejected", () => {
  const result = assertWlsDailyStoryRenderable({
    selection: selection({ entityId: OTHER }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, "cross_entity")
})

test("draft meta retains product URL and template ids; generation key is stable", () => {
  const key = buildWlsDailyStoryGenerationKey({
    marketingEntityId: "me-1",
    templateInstanceId: "tmpl-1",
  })
  assert.equal(key, "wls-daily-story:me-1:tmpl-1")

  const meta = buildWlsDailyStoryDraftMeta({
    selection: selection(),
    templateInstanceId: "tmpl-1",
    templateVersionId: "ver-1",
    sourceImageUrl: "https://cdn.example.com/dress.jpg",
    renderedUrl: "https://cdn.example.com/rendered-story.png",
  })
  assert.equal(meta.destination_url, selection().destinationUrl)
  assert.equal(meta.source_image_url, "https://cdn.example.com/dress.jpg")
  assert.equal(meta.rendered_url, "https://cdn.example.com/rendered-story.png")
  assert.notEqual(meta.source_image_url, meta.rendered_url)
  assert.equal(meta.export_width, 1080)
  assert.equal(meta.export_height, 1920)
  assert.equal(meta.generation_key, key)

  const roundTrip = readWlsDailyStoryDraftMeta({ wls_daily_story: meta })
  assert.equal(roundTrip?.destination_url, meta.destination_url)
  assert.equal(roundTrip?.marketing_entity_id, "me-1")
})

test("repeated generation key does not invent a second key shape", () => {
  const a = buildWlsDailyStoryGenerationKey({
    marketingEntityId: "me-1",
    templateInstanceId: "tmpl-1",
  })
  const b = buildWlsDailyStoryGenerationKey({
    marketingEntityId: "me-1",
    templateInstanceId: "tmpl-1",
  })
  assert.equal(a, b)
})

test("missing image fails render gate; missing price is allowed at pick time", () => {
  const noImage = assertWlsDailyStoryRenderable({
    selection: selection({
      sourceImageUrls: [],
      selectable: false,
      eligible: false,
      hardBlockers: ["missing_image"],
      exclusionReasons: ["missing_image"],
    }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
  })
  assert.equal(noImage.ok, false)

  const noPrice = assertWlsDailyStoryRenderable({
    selection: selection({
      price: null,
      softWarnings: ["missing_price"],
    }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
  })
  assert.equal(noPrice.ok, true)
})
