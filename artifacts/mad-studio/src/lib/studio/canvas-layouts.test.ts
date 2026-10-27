import assert from "node:assert/strict"
import { test } from "node:test"

import {
  applyLayoutToOverlay,
  layoutFromOverlay,
  slideOverlayBeforeLayoutApply,
  type SavedCanvasLayout,
} from "./canvas-layouts"
import {
  DEFAULT_CANVAS_TEXT_OVERLAY,
  normalizeCanvasTextOverlay,
} from "./canvas-text-types"

test("slideOverlayBeforeLayoutApply does not auto-enable listing tag toggles", () => {
  const baseline = slideOverlayBeforeLayoutApply({
    facts: {
      brand: "Zimmermann",
      size: "10",
      price: "$180",
      vibe: "Coastal",
    },
  })
  assert.equal(baseline.tagBrand, "Zimmermann")
  assert.equal(baseline.tagShowBrand, false)
  assert.equal(baseline.tagBrandY, DEFAULT_CANVAS_TEXT_OVERLAY.tagBrandY)
})

test("applyLayoutToOverlay applies saved tag positions to a fresh slide", () => {
  const styled = normalizeCanvasTextOverlay({
    ...DEFAULT_CANVAS_TEXT_OVERLAY,
    enabled: true,
    tagShowBrand: true,
    tagShowSize: true,
    tagBrand: "On layout",
    tagSize: "M",
    tagBrandX: 12,
    tagBrandY: 22,
    tagSizeX: 88,
    tagSizeY: 30,
    tagFontScale: 0.85,
  })
  const layout: SavedCanvasLayout = {
    id: "layout-1",
    name: "Spread",
    overlay: layoutFromOverlay(styled),
  }
  const slide = slideOverlayBeforeLayoutApply({
    facts: { brand: "Real brand", size: "8", price: null, vibe: null },
  })
  const applied = applyLayoutToOverlay({ layout, slide, wording: "keep-slide" })
  assert.equal(applied.tagBrand, "Real brand")
  assert.equal(applied.tagSize, "8")
  assert.equal(applied.tagBrandX, 12)
  assert.equal(applied.tagBrandY, 22)
  assert.equal(applied.tagSizeX, 88)
  assert.equal(applied.tagSizeY, 30)
  assert.equal(applied.tagFontScale, 0.85)
  assert.equal(applied.enabled, true)
  assert.equal(applied.tagShowBrand, true)
  assert.equal(applied.tagShowSize, true)
})

test("applyLayoutToOverlay keep-slide enables overlay for style-only saved layout", () => {
  const styled = normalizeCanvasTextOverlay({
    ...DEFAULT_CANVAS_TEXT_OVERLAY,
    enabled: true,
    headline: "Sale",
    positionY: 18,
    fontScale: 1.2,
  })
  const layout: SavedCanvasLayout = {
    id: "layout-style",
    name: "Top hook",
    overlay: layoutFromOverlay(styled),
  }
  const slide = slideOverlayBeforeLayoutApply({})
  const applied = applyLayoutToOverlay({ layout, slide, wording: "keep-slide" })
  assert.equal(applied.headline, "")
  assert.equal(applied.positionY, 18)
  assert.equal(applied.fontScale, 1.2)
  assert.equal(applied.enabled, true)
})
