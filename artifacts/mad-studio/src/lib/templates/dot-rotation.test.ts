import assert from "node:assert/strict"
import { test } from "node:test"

import { dotSpecialsForWeek, mondayOf, nzToday } from "./dot-rotation.ts"
import { normalizeDotColour, readListingDotFromMetrics, withListingDotMetrics } from "../inventory/listing-dot.ts"

test("week of 9 Nov 2026: Black 25% off, Blue 50% off", () => {
  const week = dotSpecialsForWeek("2026-11-12")
  assert.deepEqual(
    week.map((row) => [row.colour, row.percent]),
    [
      ["Black", 25],
      // Tagged 8–15 Oct, the last quarter-month period before the weekly rotation.
      ["Blue", 50],
    ]
  )
  assert.equal(week[0].taggedFrom, "2026-10-12")
  assert.equal(week[0].taggedTo, "2026-10-18")
})

test("the rotation moves on each Monday", () => {
  assert.deepEqual(
    dotSpecialsForWeek("2026-11-16").map((row) => [row.colour, row.percent]),
    [
      ["Pink", 25],
      ["Black", 50],
    ]
  )
  assert.deepEqual(
    dotSpecialsForWeek("2026-11-02").map((row) => [row.colour, row.percent]),
    [
      ["Blue", 25],
      ["Yellow", 50],
    ]
  )
})

test("Monday and NZ date helpers", () => {
  assert.equal(mondayOf("2026-11-15"), "2026-11-09")
  assert.equal(mondayOf("2026-11-09"), "2026-11-09")
  // 11:30 UTC on 11 Nov is already 12 Nov in New Zealand.
  assert.equal(nzToday(new Date("2026-11-11T11:30:00Z")), "2026-11-12")
})

test("dot colour is normalised and stored on the synced row", () => {
  assert.equal(normalizeDotColour(" black "), "Black")
  assert.equal(normalizeDotColour("Teal"), null)
  const stored = withListingDotMetrics({ views: 0 }, "BLACK")
  assert.equal(readListingDotFromMetrics(stored), "Black")
  assert.equal(readListingDotFromMetrics(withListingDotMetrics(stored, null)), null)
  assert.equal(withListingDotMetrics(stored, undefined), stored)
})
