import assert from "node:assert/strict"
import test from "node:test"

import { draftTime, nextDraftDay, parseYmd, ymdOf } from "./draft-day.ts"

test("nextDraftDay is this Tuesday, or next week's once it has gone", () => {
  // Monday 16 Nov 2026 → Tuesday 17
  assert.equal(ymdOf(nextDraftDay(new Date(2026, 10, 16, 20))), "2026-11-17")
  // Tuesday itself stays Tuesday
  assert.equal(ymdOf(nextDraftDay(new Date(2026, 10, 17, 8))), "2026-11-17")
  // Wednesday → next Tuesday
  assert.equal(ymdOf(nextDraftDay(new Date(2026, 10, 18, 8))), "2026-11-24")
  // Sunday → Tuesday two days on
  assert.equal(ymdOf(nextDraftDay(new Date(2026, 10, 22, 8))), "2026-11-24")
})

test("draftTime keeps the hour when there's room, else the next whole hour", () => {
  const tuesday = new Date(2026, 10, 17)
  const early = draftTime(tuesday, 11, new Date(2026, 10, 16, 20))
  assert.equal(early.getHours(), 11)
  assert.equal(early.getDate(), 17)

  // 10:40 on the day: 11:00 is under 30 minutes away, so 12:00.
  const late = draftTime(tuesday, 11, new Date(2026, 10, 17, 10, 40))
  assert.equal(late.getHours(), 12)
  assert.equal(late.getMinutes(), 0)
})

test("parseYmd reads a day and rejects anything else", () => {
  assert.equal(ymdOf(parseYmd("2026-11-17")!), "2026-11-17")
  assert.equal(parseYmd("2026-02-31"), null)
  assert.equal(parseYmd("tuesday"), null)
  assert.equal(parseYmd(null), null)
})
