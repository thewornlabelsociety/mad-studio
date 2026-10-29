import assert from "node:assert/strict"
import { test } from "node:test"

import {
  daysUntil,
  easterSunday,
  momentsForYear,
  mondayNearest,
  nthWeekday,
  momentsOnDay,
  upcomingMoments,
} from "./nz-moments.ts"

const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

function find(year: number, id: string) {
  const moment = momentsForYear(year).find((row) => row.id === id)
  assert.ok(moment, id)
  return moment
}

test("Easter Sunday", () => {
  assert.equal(ymd(easterSunday(2026)), "2026-04-05")
  assert.equal(ymd(easterSunday(2027)), "2027-03-28")
})

test("weekday rules for NZ holidays", () => {
  assert.equal(ymd(nthWeekday(2026, 10, 1, 4)), "2026-10-26") // Labour Day
  assert.equal(ymd(nthWeekday(2026, 6, 1, 1)), "2026-06-01") // King's Birthday
  assert.equal(ymd(nthWeekday(2026, 5, 0, 2)), "2026-05-10") // Mother's Day
  assert.equal(ymd(nthWeekday(2026, 9, 0, 1)), "2026-09-06") // Father's Day
  assert.equal(ymd(mondayNearest(new Date(2026, 0, 29))), "2026-01-26") // Anniversary
  assert.equal(ymd(mondayNearest(new Date(2027, 0, 29))), "2027-02-01")
})

test("school holidays and day tags", () => {
  const winter = find(2026, "school_winter")
  assert.equal(ymd(winter.start), "2026-07-04")
  assert.equal(ymd(winter.end), "2026-07-19")
  const summer = find(2026, "school_summer")
  assert.equal(ymd(summer.end), "2027-02-01")
  // Every day of a short run; a long season only on its first day.
  assert.ok(momentsOnDay(new Date(2026, 6, 10)).some((m) => m.id === "school_winter"))
  assert.ok(momentsOnDay(new Date(2026, 6, 10)).some((m) => m.id === "matariki"))
  assert.ok(momentsOnDay(new Date(2026, 4, 1)).some((m) => m.id === "ball_season"))
  assert.ok(!momentsOnDay(new Date(2026, 4, 2)).some((m) => m.id === "ball_season"))
  assert.ok(momentsOnDay(new Date(2027, 0, 5)).some((m) => m.id === "school_summer"))
  assert.ok(!momentsOnDay(new Date(2026, 1, 25)).some((m) => m.kind === "season"))
  // Graduation (a 20-day occasion) only on its first day; Black Friday weekend every day.
  assert.ok(!momentsOnDay(new Date(2026, 11, 3)).some((m) => m.id === "graduation_summer"))
  assert.ok(momentsOnDay(new Date(2026, 10, 29)).some((m) => m.id === "black_friday"))
})

test("Black Friday weekend and Matariki", () => {
  const friday = find(2026, "black_friday")
  assert.equal(ymd(friday.start), "2026-11-27")
  assert.equal(ymd(friday.end), "2026-11-30")
  assert.equal(ymd(find(2026, "matariki").start), "2026-07-10")
  assert.equal(ymd(find(2026, "easter").start), "2026-04-03")
})

test("seasons that run into the next year are still coming up in January", () => {
  const ids = upcomingMoments(new Date(2027, 0, 10)).map((moment) => moment.id)
  assert.ok(ids.includes("festival_season"))
  assert.ok(ids.includes("wedding_season"))
  assert.ok(ids.includes("waitangi"))
  assert.ok(!ids.includes("ball_season"))
})

test("late October looks ahead to Black Friday and Christmas", () => {
  const today = new Date(2026, 9, 30)
  const upcoming = upcomingMoments(today)
  const ids = upcoming.map((moment) => moment.id)
  for (const id of ["halloween", "black_friday", "christmas_functions", "christmas", "race_season"]) {
    assert.ok(ids.includes(id), id)
  }
  // Soonest first.
  const starts = upcoming.map((moment) => moment.start.getTime())
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b))
  assert.equal(daysUntil(find(2026, "halloween"), today), 1)
})
