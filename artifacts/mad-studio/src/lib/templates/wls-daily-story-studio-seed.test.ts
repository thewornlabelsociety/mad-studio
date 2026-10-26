import assert from "node:assert/strict"
import { test } from "node:test"

import type { WlsProductSelection } from "../inventory/wls-product-eligibility.ts"
import {
  buildWlsDailyStoryStudioSeed,
  buildWlsStoryFrameFromSelection,
  mergeWlsReplaceOverlay,
  wlsSelectionToItemFacts,
  WLS_DAILY_STORY_STUDIO_MAX_FRAMES,
} from "./wls-daily-story-studio-seed.ts"
import { DEFAULT_CANVAS_TEXT_OVERLAY } from "../studio/canvas-text-types.ts"
import { buildWlsDailyStoryStudioHandoffHref } from "./template-handoff.ts"

const ENTITY = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const TEMPLATE = "22222222-2222-2222-2222-222222222222"
const ME_A = "33333333-3333-3333-3333-333333333333"
const ME_B = "44444444-4444-4444-4444-444444444444"

function selection(
  overrides: Partial<WlsProductSelection> = {}
): WlsProductSelection {
  return {
    marketingEntityId: ME_A,
    websiteItemId: "wls-42",
    entityId: ENTITY,
    brand: "Zimmermann",
    title: "Linen Midi Dress",
    description: "Long catalog body should not appear on canvas tags.",
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
    eligible: true,
    exclusionReasons: [],
    template: "daily_story",
    ...overrides,
  }
}

test("wlsSelectionToItemFacts uses NZD price and verified size only", () => {
  const facts = wlsSelectionToItemFacts(selection())
  assert.equal(facts.brand, "Zimmermann")
  assert.equal(facts.size, "1")
  assert.match(facts.price ?? "", /\$890/)
  assert.equal(facts.vibe, null)
})

test("WLS studio frames keep Words empty and put listing copy on intake caption", () => {
  const frame = buildWlsStoryFrameFromSelection({
    selection: selection(),
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })
  assert.equal(frame.overlay.headline, "")
  assert.equal(frame.overlay.subhead, "")
  assert.match(frame.asset.intakeCaption ?? "", /Linen Midi Dress/)
  assert.match(frame.asset.intakeCaption ?? "", /Zimmermann/)
  assert.match(frame.asset.intakeCaption ?? "", /Size 1/)
})

test("buildWlsDailyStoryStudioSeed creates distinct frames per product", () => {
  const seed = buildWlsDailyStoryStudioSeed({
    selections: [
      selection({ marketingEntityId: ME_A, brand: "Brand A" }),
      selection({
        marketingEntityId: ME_B,
        websiteItemId: "wls-99",
        brand: "Brand B",
        title: "Silk Top",
      }),
    ],
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })

  assert.equal(seed.mediaAssets.length, 2)
  assert.equal(seed.mediaAssets[0]?.marketingEntityId, ME_A)
  assert.equal(seed.mediaAssets[1]?.marketingEntityId, ME_B)
  assert.notEqual(seed.mediaAssets[0]?.id, seed.mediaAssets[1]?.id)
  assert.equal(seed.slideOverlays[seed.mediaAssets[0]!.id]?.tagBrand, "Brand A")
  assert.equal(seed.slideOverlays[seed.mediaAssets[1]!.id]?.tagBrand, "Brand B")
  assert.equal(seed.storyPreview.stylePreset, "moody_noir")
  assert.equal(seed.storyPreview.canvasColor, "#E8DCC4")
})

test("studio handoff URL encodes story format and template instance", () => {
  const href = buildWlsDailyStoryStudioHandoffHref({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    marketingEntityIds: [ME_A, ME_B],
  })
  assert.match(href, /wlsDailyStory=1/)
  assert.match(href, /format=story/)
  assert.match(href, new RegExp(`templateInstanceId=${TEMPLATE}`))
  assert.match(href, new RegExp(`items=${ME_A}%2C${ME_B}|items=${ME_A},${ME_B}`))
})

test("mergeWlsReplaceOverlay keeps typography when replacing photo", () => {
  const seeded = buildWlsStoryFrameFromSelection({
    selection: selection({ marketingEntityId: ME_B, brand: "New Brand" }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })
  const merged = mergeWlsReplaceOverlay({
    existing: {
      ...DEFAULT_CANVAS_TEXT_OVERLAY,
      fontId: "impact_bold",
      subjectScale: 1.2,
      headline: "Old",
    },
    seeded: seeded.overlay,
    previousImageUrl: "https://cdn.example.com/a.jpg",
    nextImageUrl: "https://cdn.example.com/b.jpg",
  })
  assert.equal(merged.fontId, "impact_bold")
  assert.equal(merged.subjectScale, 1.2)
  assert.equal(merged.tagBrand, "New Brand")
  assert.equal(merged.cutoutUrl, "")
})

test("acceptance 4: replacing one frame does not drop sibling slide overlays", () => {
  const ME_C = "cccccccc-cccc-cccc-cccc-cccccccccccc"
  const frameA = buildWlsStoryFrameFromSelection({
    selection: selection({ marketingEntityId: ME_A, brand: "Brand A" }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })
  const frameC = buildWlsStoryFrameFromSelection({
    selection: selection({ marketingEntityId: ME_C, brand: "Brand C" }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })
  const replacement = buildWlsStoryFrameFromSelection({
    selection: selection({ marketingEntityId: ME_B, brand: "Brand B" }),
    entityId: ENTITY,
    brandName: "Worn Label Society",
    canvasLayouts: [],
    canvasLayoutId: "story_9_16",
    resolveImageUrl: (url) => url,
  })
  const slideOverlays = {
    [frameA.asset.id]: {
      ...DEFAULT_CANVAS_TEXT_OVERLAY,
      fontId: "keep_a",
      headline: "Frame A headline",
    },
    [frameC.asset.id]: {
      ...DEFAULT_CANVAS_TEXT_OVERLAY,
      fontId: "keep_c",
      headline: "Frame C headline",
    },
  }
  const mergedActive = mergeWlsReplaceOverlay({
    existing: slideOverlays[frameA.asset.id],
    seeded: replacement.overlay,
    previousImageUrl: frameA.asset.url,
    nextImageUrl: replacement.asset.url,
  })
  const nextOverlays = {
    ...slideOverlays,
    [replacement.asset.id]: mergedActive,
  }
  delete (nextOverlays as Record<string, unknown>)[frameA.asset.id]

  assert.deepEqual(nextOverlays[frameC.asset.id], slideOverlays[frameC.asset.id])
  assert.equal(nextOverlays[replacement.asset.id]?.tagBrand, "Brand B")
})

test("handoff caps product count", () => {
  const ids = Array.from({ length: 8 }, (_, i) =>
    `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`
  )
  const href = buildWlsDailyStoryStudioHandoffHref({
    entityId: ENTITY,
    templateInstanceId: TEMPLATE,
    marketingEntityIds: ids,
  })
  const params = new URLSearchParams(href.split("?")[1] ?? "")
  assert.equal(
    (params.get("items")?.split(",") ?? []).length,
    WLS_DAILY_STORY_STUDIO_MAX_FRAMES
  )
})
