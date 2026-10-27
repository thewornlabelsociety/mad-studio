import assert from "node:assert/strict"
import { test } from "node:test"

import {
  formatCanvasSizeTagLabel,
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
