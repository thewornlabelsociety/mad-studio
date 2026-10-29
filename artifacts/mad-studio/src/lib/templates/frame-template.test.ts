import assert from "node:assert/strict"
import { test } from "node:test"

import {
  createInstagramFeedOotdPreset,
  hasUsableFrameTemplate,
  parseFrameTemplate,
} from "./frame-template.ts"

test("OOTD preset parses with four image slots and four text slots", () => {
  const preset = createInstagramFeedOotdPreset(
    "https://example.com/ootd-bg.png"
  )
  assert.equal(preset.imageSlots.length, 4)
  assert.equal(preset.textSlots.length, 4)
  assert.ok(hasUsableFrameTemplate(preset))
  assert.equal(preset.textSlots[0]?.defaultText, "OOTD VIBES")
})

test("empty background is not usable until uploaded", () => {
  const preset = createInstagramFeedOotdPreset("")
  assert.equal(hasUsableFrameTemplate(preset), false)
})

test("parseFrameTemplate rejects garbage", () => {
  assert.equal(parseFrameTemplate({ version: 99 }), null)
  assert.ok(
    parseFrameTemplate(
      createInstagramFeedOotdPreset("https://example.com/x.png")
    )
  )
})
