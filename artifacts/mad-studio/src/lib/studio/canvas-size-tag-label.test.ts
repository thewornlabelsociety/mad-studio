import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatCanvasSizeTagLabel,
  formatSizeForText,
  stripAuSizePrefix,
} from "./canvas-size-tag-label"

test("stripAuSizePrefix removes AU prefix", () => {
  assert.equal(stripAuSizePrefix("AU 8"), "8")
  assert.equal(stripAuSizePrefix("au8"), "8")
  assert.equal(stripAuSizePrefix("10"), "10")
})

test("formatCanvasSizeTagLabel uses SIZE without AU", () => {
  assert.equal(formatCanvasSizeTagLabel("AU 8"), "SIZE 8")
  assert.equal(formatCanvasSizeTagLabel("8"), "SIZE 8")
  assert.equal(formatCanvasSizeTagLabel("Sz 10"), "SIZE 10")
  assert.equal(formatCanvasSizeTagLabel("Size M"), "SIZE M")
})

test("multi-system and one-size listings show a single size", () => {
  assert.equal(formatCanvasSizeTagLabel("AU 8 | EU 36 | US 4"), "SIZE 8")
  assert.equal(formatCanvasSizeTagLabel("AU 7.5 · EU 41 · US 8.5"), "SIZE 7.5")
  assert.equal(formatCanvasSizeTagLabel("AU 10 (EU 38)"), "SIZE 10")
  assert.equal(formatCanvasSizeTagLabel("Size: m"), "SIZE M")
  assert.equal(formatCanvasSizeTagLabel("One Size"), "ONE SIZE")
  assert.equal(formatCanvasSizeTagLabel("32"), "SIZE 32")
  assert.equal(formatSizeForText("AU 8 | EU 36 | US 4"), "Size 8")
  assert.equal(formatSizeForText("One Size"), "One size")
  assert.equal(formatSizeForText(null), null)
})
