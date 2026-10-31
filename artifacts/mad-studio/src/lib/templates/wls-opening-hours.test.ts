import assert from "node:assert/strict"
import { test } from "node:test"

import {
  dateFromKey,
  holidaysInWeek,
  nzDateKey,
  parseHoursLine,
  parseWebsiteHours,
  planForDay,
  publicHolidayOn,
  weekRows,
} from "./wls-opening-hours.ts"

/** The website's Contact page fields, October 2026. */
const CONTACT = {
  hours_weekday: "Tue–Wed  11:30am–3pm",
  hours_thursday: "Thu Late Night  10am–5pm",
  hours_saturday: "Sat  9am–2pm",
  hours_sunday: "Sun–Mon  Closed",
  hours_friday: "Fri  10am–3pm",
  hours_public_holiday: "*Public Holidays  may vary — check Google",
  location: "19b Bank Street, Whangārei CBD",
}

test("a line's days, hours and note", () => {
  assert.deepEqual(parseHoursLine("Tue–Wed  11:30am–3pm"), { days: [2, 3], hours: "11:30am – 3pm", closed: false, note: "" })
  assert.deepEqual(parseHoursLine("Thu Late Night  10am–5pm"), { days: [4], hours: "10am – 5pm", closed: false, note: "Late Night" })
  assert.deepEqual(parseHoursLine("Sun–Mon  Closed"), { days: [0, 1], hours: "", closed: true, note: "" })
  assert.deepEqual(parseHoursLine("Monday to Friday 9am - 5pm")?.days, [1, 2, 3, 4, 5])
  assert.equal(parseHoursLine(""), null)
})

test("every day of the week from the website", () => {
  const week = parseWebsiteHours(CONTACT)
  assert.deepEqual(
    week.days.map((day) => (day?.closed ? "closed" : day?.hours)),
    ["closed", "closed", "11:30am – 3pm", "11:30am – 3pm", "10am – 5pm", "10am – 3pm", "9am – 2pm"]
  )
  assert.equal(week.holidayNote, "Public Holidays may vary — check Google")
  assert.equal(week.location, "19b Bank Street, Whangārei CBD")
})

test("a line without day names fills only the days left", () => {
  const week = parseWebsiteHours({ hours_weekday: "9am–5pm", hours_friday: "Fri  9am–8pm" })
  assert.equal(week.days[1]?.hours, "9am – 5pm")
  assert.equal(week.days[5]?.hours, "9am – 8pm")
  assert.equal(week.days[6], null)
})

test("week rows run Monday to Sunday, matching days together", () => {
  const rows = weekRows(parseWebsiteHours(CONTACT))
  assert.deepEqual(
    rows.map((row) => [row.label, row.closed ? "Closed" : row.hours, row.note]),
    [
      ["Mon", "Closed", ""],
      ["Tue – Wed", "11:30am – 3pm", ""],
      ["Thu", "10am – 5pm", "Late Night"],
      ["Fri", "10am – 3pm", ""],
      ["Sat", "9am – 2pm", ""],
      ["Sun", "Closed", ""],
    ]
  )
})

test("public holidays, moved off the weekend", () => {
  assert.equal(publicHolidayOn(new Date(2026, 9, 26)), "Labour Day")
  assert.equal(publicHolidayOn(new Date(2026, 3, 3)), "Good Friday")
  assert.equal(publicHolidayOn(new Date(2026, 0, 26)), "Northland Anniversary")
  assert.equal(publicHolidayOn(new Date(2026, 6, 10)), "Matariki")
  // Anzac Day 2026 is a Saturday: observed Monday 27 April.
  assert.equal(publicHolidayOn(new Date(2026, 3, 25)), null)
  assert.equal(publicHolidayOn(new Date(2026, 3, 27)), "Anzac Day")
  // Christmas 2027 is a Saturday, Boxing Day a Sunday: Monday and Tuesday.
  assert.equal(publicHolidayOn(new Date(2027, 11, 27)), "Christmas Day")
  assert.equal(publicHolidayOn(new Date(2027, 11, 28)), "Boxing Day")
  // Christmas 2022 was a Sunday: Boxing Day Monday, Christmas Tuesday.
  assert.equal(publicHolidayOn(new Date(2022, 11, 26)), "Boxing Day")
  assert.equal(publicHolidayOn(new Date(2022, 11, 27)), "Christmas Day")
  assert.equal(publicHolidayOn(new Date(2026, 9, 30)), null)
})

test("a closed day points to the next open day, skipping holidays", () => {
  const week = parseWebsiteHours(CONTACT)
  const sunday = planForDay(week, new Date(2026, 10, 1))
  assert.equal(sunday.hours?.closed, true)
  assert.equal(sunday.nextOpen?.date.getDate(), 3)
  // Christmas 2026 is a Friday, so Boxing Day is observed on Monday 28.
  assert.equal(planForDay(week, new Date(2026, 11, 26)).holiday, null)
  assert.equal(planForDay(week, new Date(2026, 11, 28)).holiday, "Boxing Day")
  const sun27 = planForDay(week, new Date(2026, 11, 27))
  // Monday 28 is Boxing Day observed and closed anyway; Tuesday 29 is next.
  assert.equal(sun27.nextOpen?.date.getDate(), 29)
})

test("holidays in the coming week", () => {
  assert.deepEqual(holidaysInWeek(new Date(2026, 9, 21)).map(([name]) => name), ["Labour Day"])
  assert.deepEqual(holidaysInWeek(new Date(2026, 11, 28)).map(([name]) => name), ["Boxing Day", "New Year's Day"])
})

test("today in New Zealand", () => {
  // 11pm UTC on 29 October is midday on the 30th in Whangārei.
  assert.equal(nzDateKey(new Date(Date.UTC(2026, 9, 29, 23))), "2026-10-30")
  assert.equal(dateFromKey("2026-10-30").getDay(), 5)
})
