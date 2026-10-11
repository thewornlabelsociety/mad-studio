"use client"

import { useMemo, useState } from "react"

import { PlannerDayCard } from "@/components/planner/planner-day-card"
import {
  buildDayCell,
  buildMonthGrid,
  buildWeekRow,
  formatPlannerMonthYear,
  gridColumnsForView,
  gridRowsForView,
  isSameDay,
  plannerWeekdayLabels,
  type PlannerCalendarView,
} from "@/components/planner/planner-calendar-utils"
import type { PlannerTimelineDay } from "@/lib/planner/planner-timeline-types"
import { cn } from "@/lib/utils"

const VIEW_OPTIONS: { id: PlannerCalendarView; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
]

type Props = {
  anchorDate: Date
  timeline: PlannerTimelineDay[]
  onSelectDay: (day: PlannerTimelineDay) => void
}

export function PlannerCalendarCanvas({
  anchorDate,
  timeline,
  onSelectDay,
}: Props) {
  const [view, setView] = useState<PlannerCalendarView>("month")

  const timelineByDate = useMemo(() => {
    const map = new Map<string, PlannerTimelineDay>()
    for (const day of timeline) {
      const key = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`
      map.set(key, day)
    }
    return map
  }, [timeline])

  const cells = useMemo(() => {
    if (view === "day") return buildDayCell(anchorDate)
    if (view === "week") return buildWeekRow(anchorDate)
    return buildMonthGrid(anchorDate)
  }, [anchorDate, view])

  const columns = gridColumnsForView(view)
  const rows = gridRowsForView(view)
  const showWeekdayHeader = view !== "day"

  function dayForCell(date: Date): PlannerTimelineDay | undefined {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    return timelineByDate.get(key)
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-mad-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-mad-black px-4 py-3">
        <p className="font-typewriter text-sm font-bold tracking-widest text-mad-black uppercase">
          {formatPlannerMonthYear(anchorDate)}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VIEW_OPTIONS.map((option) => {
            const active = view === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={cn(
                  "border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase transition-colors",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap-sm"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                [ {option.label} ]
              </button>
            )
          })}
        </div>
      </div>

      {showWeekdayHeader ? (
        <div
          className="grid shrink-0 border-b-2 border-mad-black bg-mad-white"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {plannerWeekdayLabels().map((label) => (
            <div
              key={label}
              className="border-r-2 border-mad-black px-2 py-2 text-center font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase last:border-r-0"
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-0">
        <div
          className="grid h-full min-h-[320px] w-full transition-[grid-template-rows,grid-template-columns] duration-200 ease-out"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          }}
        >
          {cells.map((cell) => {
            const key = cell.date.toISOString()
            const card = dayForCell(cell.date)
            const hasTimeline = timeline.some((row) => isSameDay(row.date, cell.date))
            return (
              <div
                key={key}
                className={cn(
                  "relative min-h-[4.5rem] border-2 border-mad-black bg-mad-white p-2",
                  view === "month" && !cell.inCurrentMonth && "bg-neutral-50",
                  view === "day" && "min-h-[20rem]",
                  hasTimeline && "pb-1"
                )}
              >
                <span
                  className={cn(
                    "absolute top-2 right-2 font-typewriter text-[0.65rem] font-bold tabular-nums",
                    cell.inCurrentMonth ? "text-mad-black" : "text-neutral-400"
                  )}
                >
                  {cell.date.getDate()}
                </span>
                {card ? (
                  <PlannerDayCard day={card} onSelect={onSelectDay} />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
