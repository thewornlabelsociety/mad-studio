"use client"

import type { PlannerTimelineDay } from "@/lib/planner/planner-timeline-types"
import { cn } from "@/lib/utils"

type Props = {
  day: PlannerTimelineDay
  onSelect: (day: PlannerTimelineDay) => void
  className?: string
}

export function PlannerDayCard({ day, onSelect, className }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(day)}
      className={cn(
        "mt-6 w-full border-2 border-mad-black bg-mad-white p-2 text-left shadow-keycap-sm transition-colors hover:bg-mad-lime/20",
        className
      )}
    >
      <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-black uppercase">
        <span className="inline-block bg-[#CCFF00] px-1 py-0.5">DRAFT</span>
      </p>
      <p className="mt-1 font-typewriter text-[0.55rem] font-bold tracking-wide text-mad-black uppercase">
        {day.phase}
      </p>
      <p className="mt-1 line-clamp-3 font-typewriter text-[0.55rem] leading-snug text-neutral-700 italic">
        {day.directorialAction}
      </p>
    </button>
  )
}
