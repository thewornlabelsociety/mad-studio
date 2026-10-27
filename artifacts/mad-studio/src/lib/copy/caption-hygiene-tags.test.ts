import assert from "node:assert/strict"
import { test } from "node:test"

import {
  cleanHashtags,
  isCleanHashtag,
  scrubInlineHashtags,
} from "./caption-hygiene"
import { normalizeOptTag } from "@/lib/inventory/optimization-tags"

test("rejects price-derived numeric hashtags like 4500 from $45.00", () => {
  assert.equal(normalizeOptTag("$45.00"), null)
  assert.equal(normalizeOptTag("45.00"), null)
  assert.equal(normalizeOptTag("4500"), null)
  assert.equal(isCleanHashtag("4500"), false)
  assert.equal(isCleanHashtag("#4500"), false)
  assert.deepEqual(cleanHashtags(["justjeans", "4500", "wornlabelsociety"]), [
    "justjeans",
    "wornlabelsociety",
  ])
})

test("scrubInlineHashtags drops numeric item-code tags from caption body", () => {
  const scrubbed = scrubInlineHashtags(
    "Vest Just Jeans in Navy\n\n#justjeans #4500"
  )
  assert.match(scrubbed, /#justjeans/)
  assert.doesNotMatch(scrubbed, /#4500/)
})

test("allows letter+digit discovery tags", () => {
  assert.equal(isCleanHashtag("nz2024"), true)
  assert.equal(normalizeOptTag("preloved"), "preloved")
})
