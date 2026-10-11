export type PlannerCalendarView = "day" | "week" | "month"

export type PlannerCalendarCell = {
  date: Date
  inCurrentMonth: boolean
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

export function plannerWeekdayLabels(): readonly string[] {
  return WEEKDAY_LABELS
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatPlannerMonthYear(date: Date): string {
  return date
    .toLocaleDateString("en-NZ", { month: "long", year: "numeric" })
    .toUpperCase()
}

export function buildMonthGrid(anchor: Date): PlannerCalendarCell[] {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = startOfWeekMonday(firstOfMonth)
  const cells: PlannerCalendarCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i)
    cells.push({
      date,
      inCurrentMonth: date.getMonth() === month,
    })
  }
  return cells
}

export function buildWeekRow(anchor: Date): PlannerCalendarCell[] {
  const start = startOfWeekMonday(anchor)
  return Array.from({ length: 7 }, (_, i) => ({
    date: addDays(start, i),
    inCurrentMonth: true,
  }))
}

export function buildDayCell(anchor: Date): PlannerCalendarCell[] {
  return [
    {
      date: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()),
      inCurrentMonth: true,
    },
  ]
}

export function gridColumnsForView(view: PlannerCalendarView): number {
  if (view === "day") return 1
  return 7
}

export function gridRowsForView(view: PlannerCalendarView): number {
  if (view === "day") return 1
  if (view === "week") return 1
  return 6
}
