import { easterSunday, MATARIKI, mondayNearest, nthWeekday } from "../planner/nz-moments.ts"

/**
 * Opening hours for the Worn Label Society posts. The website keeps them as
 * free text on its Contact page ("Tue–Wed  11:30am–3pm", "Sun–Mon  Closed");
 * this reads each line into the days it covers.
 */

/** The website's contact fields, as /api/website/opening-hours returns them. */
export type WebsiteContact = Partial<
  Record<
    | "hours_weekday"
    | "hours_thursday"
    | "hours_friday"
    | "hours_saturday"
    | "hours_sunday"
    | "hours_public_holiday"
    | "location"
    | "location_detail",
    string
  >
>

export type DayHours = {
  /** e.g. "10am – 5pm"; empty when closed. */
  hours: string
  closed: boolean
  /** Words beside the days on the website, e.g. "Late Night". */
  note: string
}

export type WeekHours = {
  /** Index 0 is Sunday, as Date.getDay(); null when the website doesn't say. */
  days: Array<DayHours | null>
  /** The website's public holiday line, e.g. "Public Holidays may vary — check Google". */
  holidayNote: string
  location: string
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** Days a line covers when its label names none, by field. */
const FIELD_DAYS: Array<[keyof WebsiteContact, number[]]> = [
  ["hours_thursday", [4]],
  ["hours_friday", [5]],
  ["hours_saturday", [6]],
  ["hours_sunday", [0]],
  ["hours_weekday", [1, 2, 3, 4, 5]],
]

const DAY_TOKEN = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?/gi
const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

function tidy(text: string): string {
  return text.replace(/^\*+/, "").replace(/\s+/g, " ").trim()
}

/** "11:30am–3pm" → "11:30am – 3pm". */
function tidyHours(text: string): string {
  return tidy(text).replace(/\s*[–—-]\s*/g, " – ")
}

/** One website line: the days it names, its hours and any note beside the days. */
export function parseHoursLine(text: string): { days: number[]; hours: string; closed: boolean; note: string } | null {
  const line = text.trim()
  if (!line) return null
  // The site puts two spaces between the days and the hours.
  let split = line.search(/\s{2,}/)
  if (split < 0) split = line.search(/\d|closed/i)
  const label = split > 0 ? line.slice(0, split) : ""
  const rest = split > 0 ? line.slice(split) : line
  const tokens = Array.from(label.matchAll(DAY_TOKEN))
  const days: number[] = []
  tokens.forEach((token, index) => {
    const day = DAY_INDEX[token[1].toLowerCase()]
    const previous = tokens[index - 1]
    const between = previous ? label.slice(previous.index! + previous[0].length, token.index) : ""
    if (previous && /^\s*([–—-]|to)\s*$/i.test(between)) {
      // A range like Sun–Mon wraps round the week.
      for (let d = (DAY_INDEX[previous[1].toLowerCase()] + 1) % 7; d !== day; d = (d + 1) % 7) days.push(d)
    }
    days.push(day)
  })
  const note = tidy(label.replace(DAY_TOKEN, "").replace(/[–—-]|\bto\b|,|&/gi, " "))
  const closed = /closed/i.test(rest)
  return { days: Array.from(new Set(days)), hours: closed ? "" : tidyHours(rest), closed, note }
}

export function parseWebsiteHours(contact: WebsiteContact): WeekHours {
  const days: Array<DayHours | null> = Array(7).fill(null)
  const unnamed: Array<[number[], DayHours]> = []
  for (const [field, fallback] of FIELD_DAYS) {
    const parsed = parseHoursLine(contact[field] ?? "")
    if (!parsed) continue
    const value = { hours: parsed.hours, closed: parsed.closed, note: parsed.note }
    if (parsed.days.length === 0) {
      unnamed.push([fallback, value])
      continue
    }
    for (const day of parsed.days) days[day] ??= value
  }
  // A line without day names fills only the days no other line covers.
  for (const [fallback, value] of unnamed) for (const day of fallback) days[day] ??= value
  return {
    days,
    holidayNote: tidy(contact.hours_public_holiday ?? ""),
    location: tidy(contact.location ?? ""),
  }
}

export type WeekRow = { label: string; hours: string; closed: boolean; note: string; days: number[] }

function sameHours(a: DayHours | null, b: DayHours | null): boolean {
  if (!a || !b) return a === b
  return a.closed === b.closed && a.hours === b.hours && a.note === b.note
}

/** Monday to Sunday, with neighbouring days that match on one row ("Tue – Wed"). */
export function weekRows(week: WeekHours): WeekRow[] {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const rows: WeekRow[] = []
  for (const day of order) {
    const hours = week.days[day]
    if (!hours) continue
    const last = rows[rows.length - 1]
    const lastDay = last?.days[last.days.length - 1]
    if (last && order.indexOf(lastDay) === order.indexOf(day) - 1 && sameHours(week.days[lastDay], hours)) {
      last.days.push(day)
      continue
    }
    rows.push({ label: "", hours: hours.hours, closed: hours.closed, note: hours.note, days: [day] })
  }
  for (const row of rows) {
    const first = DAY_SHORT[row.days[0]]
    row.label = row.days.length > 1 ? `${first} – ${DAY_SHORT[row.days[row.days.length - 1]]}` : first
  }
  return rows
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const day = (year: number, month: number, date: number) => new Date(year, month - 1, date)

/** Weekend holidays move to the next weekday that isn't already a holiday. */
function mondayise(dates: Array<[string, Date]>): Array<[string, Date]> {
  const weekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6
  const taken = new Set(dates.filter(([, date]) => !weekend(date)).map(([, date]) => date.getTime()))
  return dates.map(([name, date]) => {
    if (!weekend(date)) return [name, date]
    let next = addDays(date, 1)
    while (weekend(next) || taken.has(next.getTime())) next = addDays(next, 1)
    taken.add(next.getTime())
    return [name, next]
  })
}

/** New Zealand public holidays (observed dates) for a year, plus Northland Anniversary. */
export function nzPublicHolidays(year: number): Array<[string, Date]> {
  const easter = easterSunday(year)
  const matariki = MATARIKI[year]
  return [
    ...mondayise([["New Year's Day", day(year, 1, 1)], ["Day after New Year's", day(year, 1, 2)]]),
    ["Northland Anniversary", mondayNearest(day(year, 1, 29))],
    ...mondayise([["Waitangi Day", day(year, 2, 6)]]),
    ["Good Friday", addDays(easter, -2)],
    ["Easter Monday", addDays(easter, 1)],
    ...mondayise([["Anzac Day", day(year, 4, 25)]]),
    ["King's Birthday", nthWeekday(year, 6, 1, 1)],
    ...(matariki ? ([["Matariki", day(year, matariki[0], matariki[1])]] as Array<[string, Date]>) : []),
    ["Labour Day", nthWeekday(year, 10, 1, 4)],
    ...mondayise([["Christmas Day", day(year, 12, 25)], ["Boxing Day", day(year, 12, 26)]]),
  ]
}

/** The public holiday on a date, or null. */
export function publicHolidayOn(date: Date): string | null {
  const target = day(date.getFullYear(), date.getMonth() + 1, date.getDate()).getTime()
  return nzPublicHolidays(date.getFullYear()).find(([, holiday]) => holiday.getTime() === target)?.[0] ?? null
}

/** Today's date in New Zealand as YYYY-MM-DD, wherever the browser is. */
export function nzDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now)
}

/** A YYYY-MM-DD key as a local calendar date. */
export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return day(y, m, d)
}

/** "Friday 30 October". */
export function dayLabel(date: Date): { day: string; date: string } {
  return { day: DAY_NAMES[date.getDay()], date: `${date.getDate()} ${MONTHS[date.getMonth()]}` }
}

export type DayPlan = {
  date: Date
  hours: DayHours | null
  holiday: string | null
  /** When closed: the next day open within a week, for "Back Tuesday". */
  nextOpen: { date: Date; hours: DayHours } | null
}

export function planForDay(week: WeekHours, date: Date): DayPlan {
  const hours = week.days[date.getDay()]
  let nextOpen: DayPlan["nextOpen"] = null
  if (!hours || hours.closed) {
    for (let offset = 1; offset <= 7; offset++) {
      const next = addDays(date, offset)
      const nextHours = week.days[next.getDay()]
      if (nextHours && !nextHours.closed && !publicHolidayOn(next)) {
        nextOpen = { date: next, hours: nextHours }
        break
      }
    }
  }
  return { date, hours, holiday: publicHolidayOn(date), nextOpen }
}

/** Public holidays in the seven days from `from`, for the week post's footnote. */
export function holidaysInWeek(from: Date): Array<[string, Date]> {
  const start = day(from.getFullYear(), from.getMonth() + 1, from.getDate())
  const end = addDays(start, 6)
  return [start.getFullYear(), end.getFullYear()]
    .filter((year, index, years) => years.indexOf(year) === index)
    .flatMap(nzPublicHolidays)
    .filter(([, date]) => date >= start && date <= end)
}
