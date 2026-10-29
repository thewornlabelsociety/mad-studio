"use client"

import { useMemo, useState } from "react"
import { Link } from "wouter"
import { ArrowRight, CalendarDays, ChevronDown } from "lucide-react"

import { daysUntil, upcomingMoments, type MomentKind, type NzMoment } from "@/lib/planner/nz-moments"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<MomentKind, string> = {
  holiday: "Holiday",
  sale: "Sale day",
  season: "Season",
  occasion: "Occasion",
  cause: "Cause",
}

function dateLabel(moment: NzMoment): string {
  const format = (date: Date, withYear = false) =>
    date.toLocaleDateString("en-NZ", {
      weekday: moment.start.getTime() === moment.end.getTime() ? "short" : undefined,
      day: "numeric",
      month: "short",
      year: withYear ? "numeric" : undefined,
    })
  if (moment.start.getTime() === moment.end.getTime()) return format(moment.start)
  const crossesYear = moment.start.getFullYear() !== moment.end.getFullYear()
  return `${format(moment.start, crossesYear)} – ${format(moment.end, crossesYear)}`
}

function whenLabel(moment: NzMoment, today: Date): string {
  const days = daysUntil(moment, today)
  if (days <= 0) return "On now"
  if (days === 1) return "Tomorrow"
  if (days < 14) return `In ${days} days`
  return `In ${Math.round(days / 7)} weeks`
}

/**
 * NZ dates and seasons coming up, with post ideas and a ready-made
 * announcement for each. Compact shows the next few as single lines.
 */
export function ComingUp({
  entityId,
  compact = false,
  days = compact ? 21 : 75,
}: {
  entityId: string
  compact?: boolean
  days?: number
}) {
  const today = useMemo(() => new Date(), [])
  const moments = useMemo(() => upcomingMoments(today, days), [today, days])
  const [openId, setOpenId] = useState<string | null>(null)
  const announce = (moment: NzMoment) =>
    `/templates/wls-announcement?eid=${encodeURIComponent(entityId)}&moment=${encodeURIComponent(moment.id)}`

  if (moments.length === 0) return null

  if (compact) {
    return (
      <section aria-labelledby="coming-up-heading" className="border-2 border-mad-black bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="coming-up-heading" className="flex items-center gap-1.5 font-typewriter text-xs uppercase tracking-widest">
            <CalendarDays className="size-3.5" aria-hidden />
            Coming up
          </h2>
          <Link href={`/week?eid=${encodeURIComponent(entityId)}`} className="text-xs underline underline-offset-2">
            All dates
          </Link>
        </div>
        <ul className="mt-2 grid gap-1.5">
          {moments.slice(0, 3).map((moment) => (
            <li key={`${moment.id}-${moment.start.getTime()}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{moment.name}</span>{" "}
                <span className="text-mad-black/60">
                  · {whenLabel(moment, today)} · {moment.ideas[0]}
                </span>
              </span>
              <Link
                href={announce(moment)}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium underline underline-offset-2"
              >
                Make the card <ArrowRight className="size-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section aria-labelledby="coming-up-heading" className="grid gap-2">
      <h2 id="coming-up-heading" className="flex items-center gap-1.5 font-typewriter text-xs uppercase tracking-widest">
        <CalendarDays className="size-3.5" aria-hidden />
        Coming up in NZ
      </h2>
      <p className="text-sm text-mad-black/70">
        Holidays, sale days and seasons in the next {Math.round(days / 7)} weeks, with ideas to post.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((moment) => {
          const key = `${moment.id}-${moment.start.getTime()}`
          const open = openId === key
          return (
            <li key={key} className="flex flex-col gap-2 border-2 border-mad-black/15 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">
                    {KIND_LABEL[moment.kind]} · {dateLabel(moment)}
                  </p>
                  <h3 className="text-sm font-semibold">{moment.name}</h3>
                </div>
                <span
                  className={cn(
                    "shrink-0 px-1.5 py-0.5 text-[11px] font-medium",
                    daysUntil(moment, today) <= 0 ? "bg-mad-black text-mad-white" : "bg-mad-lime/50"
                  )}
                >
                  {whenLabel(moment, today)}
                </span>
              </div>
              <p className="text-xs text-mad-black/70">{moment.why}</p>
              <ul className={cn("grid gap-0.5 text-xs", !open && "hidden")}>
                {moment.ideas.map((idea) => (
                  <li key={idea}>· {idea}</li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : key)}
                  aria-expanded={open}
                  className="inline-flex items-center gap-1 text-xs text-mad-black/70 hover:text-mad-black"
                >
                  {open ? "Hide ideas" : `${moment.ideas.length} post ideas`}
                  <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} aria-hidden />
                </button>
                <Link
                  href={announce(moment)}
                  className="inline-flex items-center gap-1 border-2 border-mad-black px-2 py-1 text-xs font-medium hover:bg-mad-lime/40"
                >
                  Make the card <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
