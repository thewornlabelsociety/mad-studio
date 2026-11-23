import assert from "node:assert/strict"
import test from "node:test"

import { chunkFrames, groupByVibe, percentOffOf, pickArrivals, pickSale, setPostTime } from "./daily-story-set.ts"

const piece = (id: string, extra: Partial<{ wasPrice: number; price: number; discountedAt: string; storySharedAt: string }> = {}) => ({
  id,
  price: extra.price ?? 40,
  wasPrice: extra.wasPrice ?? null,
  discountedAt: extra.discountedAt ?? null,
  storySharedAt: extra.storySharedAt ?? null,
})

test("arrivals are the newest unshared pieces that aren't marked down", () => {
  const rows = [piece("a"), piece("sale", { wasPrice: 60, price: 30 }), piece("shared", { storySharedAt: "2026-11-01" }), piece("b"), piece("c")]
  assert.deepEqual(pickArrivals(rows, 2).map((r) => r.id), ["a", "b"])
})

test("pieces sharing a vibe sit together, vibes in first-seen order", () => {
  const items = [
    { id: 1, vibe: "Surf" },
    { id: 2, vibe: "Heritage" },
    { id: 3, vibe: "surf" },
    { id: 4, vibe: null },
    { id: 5, vibe: "Heritage" },
  ]
  assert.deepEqual(groupByVibe(items, (i) => i.vibe).map((i) => i.id), [1, 3, 2, 5, 4])
})

test("sale splits into about 25% and about 50% off, newest markdown first", () => {
  const rows = [
    piece("q-old", { wasPrice: 40, price: 30, discountedAt: "2026-11-01" }),
    piece("q-new", { wasPrice: 50, price: 37.5, discountedAt: "2026-11-10" }),
    piece("h", { wasPrice: 60, price: 30, discountedAt: "2026-11-05" }),
    piece("ten", { wasPrice: 50, price: 45, discountedAt: "2026-11-11" }),
    piece("new-in"),
  ]
  const { quarter, half } = pickSale(rows, 5)
  assert.deepEqual(quarter.map((r) => r.id), ["q-new", "q-old"])
  assert.deepEqual(half.map((r) => r.id), ["h"])
  assert.equal(percentOffOf(60, 30), 50)
})

test("frames go up in batches of ten", () => {
  assert.deepEqual(chunkFrames([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 10).map((c) => c.length), [10, 2])
})

test("the set posts at 8am, or in the next five minutes once 8am has gone", () => {
  assert.equal(setPostTime(new Date(2026, 10, 20, 6, 30)).getHours(), 8)
  const late = setPostTime(new Date(2026, 10, 20, 9, 12))
  assert.equal(late.getHours(), 9)
  assert.equal(late.getMinutes(), 20)
})
