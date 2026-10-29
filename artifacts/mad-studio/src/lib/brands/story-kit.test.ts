import assert from "node:assert/strict"
import { test } from "node:test"

import {
  contrastRatio,
  detectItemTraits,
  pickStoryBackground,
  readableTextOn,
  resolveStoryKit,
  WLS_STORY_KIT,
} from "./story-kit.ts"

const pick = (text: string, previousId?: string, colour?: { r: number; g: number; b: number }) =>
  pickStoryBackground({
    kit: WLS_STORY_KIT,
    traits: detectItemTraits({ text, colour }),
    previousId,
  }).background.id

test("Worn Label's own notes decide the background", () => {
  assert.equal(pick("Cream cable knit jumper"), "deep_green")
  assert.equal(pick("Nike Air Max 90 sneakers"), "charcoal")
  assert.equal(pick("Levi's 501 raw indigo jeans"), "vintage_beige")
  assert.equal(pick("Khaki cargo trousers"), "faded_olive")
  assert.equal(pick("White linen shirt"), "worn_taupe")
  assert.equal(pick("Tan leather belt bag"), "deep_green")
})

test("the same best match twice in a row moves to the next-best", () => {
  assert.equal(pick("Cream cable knit jumper", "deep_green"), "faded_olive")
  assert.equal(pick("Black floral slip dress", "vintage_beige"), "worn_taupe")
})

test("no matching trait rotates through the kit", () => {
  assert.equal(pick("Mystery item", "charcoal"), "vintage_beige")
  assert.equal(pick("Mystery item"), "deep_green")
})

test("cutout colour fills in when the listing names no colour", () => {
  assert.equal(pick("Wool coat", undefined, { r: 18, g: 18, b: 20 }), "vintage_beige")
  assert.equal(pick("Wool coat", undefined, { r: 226, g: 40, b: 60 }), "charcoal")
  assert.equal(pick("Wool coat", undefined, { r: 236, g: 226, b: 205 }), "deep_green")
  // A named colour beats the photo.
  assert.equal(pick("Black wool coat", undefined, { r: 236, g: 226, b: 205 }), "vintage_beige")
})

test("denim splits on wash words, then on how light the cutout is", () => {
  assert.ok(detectItemTraits({ text: "Acid wash denim jacket" }).includes("washed_denim"))
  assert.ok(detectItemTraits({ text: "Denim jacket", colour: { r: 150, g: 175, b: 205 } }).includes("washed_denim"))
  assert.ok(detectItemTraits({ text: "Denim jacket", colour: { r: 30, g: 43, b: 70 } }).includes("dark_denim"))
})

test("text colour is whichever of cream or charcoal reads better", () => {
  assert.equal(readableTextOn("#07594F"), "#F1EADB")
  assert.equal(readableTextOn("#D7C4A6"), "#252525")
  assert.equal(readableTextOn("#A68D78"), "#252525")
  for (const background of WLS_STORY_KIT) {
    assert.ok(
      contrastRatio(background.color, background.text_color) >= 3,
      `${background.name} text must pass large-text contrast`
    )
  }
})

test("a saved kit wins; bad colours are dropped; text fills in", () => {
  const kit = resolveStoryKit({
    presets: {
      canvas_color: "#FFFFFF",
      text_color: "#000000",
      accent_color: "#FF0000",
      story_kit: [
        { id: "a", name: "Sea", color: "#0a3d62", text_color: "", accent_color: "", suits: ["cream", "nonsense"] },
        { id: "b", name: "Broken", color: "blue", text_color: "#fff", accent_color: "#fff" },
      ],
    },
    isWornLabel: true,
  })
  assert.equal(kit.length, 1)
  assert.equal(kit[0].color, "#0A3D62")
  assert.equal(kit[0].text_color, "#F1EADB")
  assert.deepEqual(kit[0].suits, ["cream"])
})

test("Worn Label without a saved kit gets its five; other brands get one", () => {
  const presets = { canvas_color: "#111111", text_color: "#FFFFFF", accent_color: "#CCFF00" }
  assert.equal(resolveStoryKit({ presets, isWornLabel: true }).length, 5)
  const other = resolveStoryKit({ presets, isWornLabel: false })
  assert.equal(other.length, 1)
  assert.equal(other[0].color, "#111111")
})
