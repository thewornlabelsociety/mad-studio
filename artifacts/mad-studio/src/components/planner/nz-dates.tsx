"use client"

import { useMemo, useState } from "react"

import { KIND_LABEL, MomentCard } from "@/components/planner/coming-up"
import { daysUntil, upcomingMoments, type MomentKind, type NzMoment } from "@/lib/planner/nz-moments"
import { cn } from "@/lib/utils"

const KINDS: MomentKind[] = ["holiday", "school", "sale", "season", "occasion", "cause"]

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}`
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-NZ", { month: "long", year: "numeric" })
}

/** A year of NZ dates and seasons by month, with what's on now first. */
export function NzDates({ entityId }: { entityId: string }) {
  const today = useMemo(() => new Date(), [])
  // Starts within a year (lead times would otherwise pull in next year's too).
  const all = useMemo(
    () => upcomingMoments(today, 365).filter((moment) => daysUntil(moment, today) <= 365),
    [today]
  )
  const [kinds, setKinds] = useState<Set<MomentKind>>(() => new Set(KINDS))

  const shown = all.filter((moment) => kinds.has(moment.kind))
  const onNow = shown.filter((moment) => daysUntil(moment, today) <= 0)
  const months = useMemo(() => {
    const groups: Array<{ key: string; label: string; moments: NzMoment[] }> = []
    for (const moment of shown) {
      if (daysUntil(moment, today) <= 0) continue
      const key = monthKey(moment.start)
      const last = groups[groups.length - 1]
      if (last?.key === key) last.moments.push(moment)
      else groups.push({ key, label: monthLabel(moment.start), moments: [moment] })
    }
    return groups
  }, [shown, today])

  function toggle(kind: MomentKind) {
    setKinds((current) => {
      const next = new Set(current)
      if (next.has(kind) && next.size > 1) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const grid = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
          <div>
            <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
              The next 12 months
            </p>
            <h1 className="brand-typewriter text-xl">NZ dates and seasons</h1>
            <p className="mt-1 max-w-xl text-sm text-mad-black/70">
              Holidays, sale days, change of season and the occasions people shop for.
              Each has post ideas and a card ready to edit. Plan posts a few weeks ahead.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
            {KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={kinds.has(kind)}
                onClick={() => toggle(kind)}
                className={cn(
                  "border px-2.5 py-1 text-xs",
                  kinds.has(kind) ? "border-mad-black bg-mad-black text-mad-white" : "border-mad-black/30 hover:border-mad-black"
                )}
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </header>

        {onNow.length > 0 ? (
          <section aria-labelledby="dates-now" className="grid gap-2">
            <h2 id="dates-now" className="font-typewriter text-xs uppercase tracking-widest">
              On now
            </h2>
            <ul className={grid}>
              {onNow.map((moment) => (
                <MomentCard key={`${moment.id}-${moment.start.getTime()}`} moment={moment} today={today} entityId={entityId} />
              ))}
            </ul>
          </section>
        ) : null}

        {months.map((month) => (
          <section key={month.key} aria-labelledby={`dates-${month.key}`} className="grid gap-2">
            <h2 id={`dates-${month.key}`} className="font-typewriter text-xs uppercase tracking-widest">
              {month.label}
            </h2>
            <ul className={grid}>
              {month.moments.map((moment) => (
                <MomentCard key={`${moment.id}-${moment.start.getTime()}`} moment={moment} today={today} entityId={entityId} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
