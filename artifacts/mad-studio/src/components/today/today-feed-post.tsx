"use client"

import { useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import { AlertTriangle, ArrowRight, CalendarRange, Check, Clock, Plus } from "lucide-react"

import { fetchCalendarPosts, type CalendarPost } from "@/lib/planner/calendar-posts"
import { addDays, mondayOf, planWeek, WLS_WEEK_RHYTHM, type PlannedDay } from "@/lib/planner/week-rhythm"
import { cn } from "@/lib/utils"

const STATE: Record<PlannedDay["state"], { label: string; className: string }> = {
  posted: { label: "Posted", className: "bg-emerald-100 text-emerald-800" },
  planned: { label: "Planned", className: "bg-mad-black text-mad-white" },
  failed: { label: "Didn't post", className: "bg-mad-vermillion/15 text-mad-vermillion" },
  empty: { label: "Not made yet", className: "bg-black/5 text-mad-black/60" },
}

/** Today's slot in the weekly rhythm, and a look at tomorrow's. */
export function TodayFeedPost({ entityId, className }: { entityId: string; className?: string }) {
  const [posts, setPosts] = useState<CalendarPost[] | null>(null)
  const today = useMemo(() => new Date(), [])
  const weekStart = useMemo(() => mondayOf(today), [today])
  const query = `?eid=${encodeURIComponent(entityId)}`

  useEffect(() => {
    let cancelled = false
    // Two weeks, so Sunday can still see Monday's slot.
    fetchCalendarPosts({ entityId, from: weekStart, to: addDays(weekStart, 14) })
      .then((rows) => !cancelled && setPosts(rows))
      .catch(() => !cancelled && setPosts([]))
    return () => {
      cancelled = true
    }
  }, [entityId, weekStart])

  const days = useMemo(() => {
    if (!posts) return null
    return [
      ...planWeek({ weekStart, posts, rhythm: WLS_WEEK_RHYTHM }),
      ...planWeek({ weekStart: addDays(weekStart, 7), posts, rhythm: WLS_WEEK_RHYTHM }),
    ]
  }, [posts, weekStart])
  const index = (today.getDay() + 6) % 7
  const now = days?.[index] ?? null
  const next = days?.[index + 1] ?? null

  return (
    <section
      aria-labelledby="today-post-heading"
      className={cn("grid gap-3 border-2 border-mad-black bg-white p-3 sm:grid-cols-[minmax(0,1fr)_auto]", className)}
    >
      <div className="flex min-w-0 items-center gap-3">
        {now?.posts[0]?.mediaUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={now.posts[0].mediaUrls[0]} alt="" className="h-14 w-11 shrink-0 rounded-sm object-cover" />
        ) : null}
        <div className="min-w-0">
          <h2 id="today-post-heading" className="font-typewriter text-xs font-bold uppercase tracking-widest">
            Today&apos;s feed post
          </h2>
          {now ? (
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{now.slot.title}</span>
              <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", STATE[now.state].className)}>
                {now.state === "posted" ? <Check className="size-3" aria-hidden /> : null}
                {now.state === "planned" ? <Clock className="size-3" aria-hidden /> : null}
                {now.state === "failed" ? <AlertTriangle className="size-3" aria-hidden /> : null}
                {now.slot.optional && now.state === "empty" ? "Optional" : STATE[now.state].label}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 h-5 w-40 animate-pulse rounded bg-black/5" />
          )}
          {next ? (
            <p className="mt-0.5 truncate text-xs text-mad-black/60">
              Tomorrow: {next.slot.title}
              {next.state !== "empty" ? ` · ${STATE[next.state].label.toLowerCase()}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {now && now.state === "empty" ? (
          <Link
            href={`${now.slot.path}${query}`}
            className="flex h-9 items-center gap-1.5 bg-mad-black px-3 text-xs font-medium text-mad-white"
          >
            <Plus className="size-3.5" aria-hidden /> Make it
          </Link>
        ) : null}
        <Link
          href={`/week${query}`}
          className="flex h-9 items-center gap-1.5 border-2 border-mad-black px-3 text-xs font-medium"
        >
          <CalendarRange className="size-3.5" aria-hidden /> Plan the week
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  )
}

/** Only shows when something needs attention: failed posts or a stalled scheduler. */
export function TodayAlerts({
  entityId,
  failedCount,
  schedulerPaused,
  className,
}: {
  entityId: string
  failedCount: number
  schedulerPaused: boolean
  className?: string
}) {
  if (failedCount === 0 && !schedulerPaused) return null
  const query = `?eid=${encodeURIComponent(entityId)}`
  return (
    <div role="status" className={cn("flex flex-wrap gap-2", className)}>
      {failedCount > 0 ? (
        <Link
          href={`/planner${query}`}
          className="flex items-center gap-2 border-2 border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-sm hover:bg-mad-vermillion/20"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {failedCount} post{failedCount === 1 ? "" : "s"} didn&apos;t go out. Open the calendar to retry.
        </Link>
      ) : null}
      {schedulerPaused ? (
        <Link
          href={`/planner${query}`}
          className="flex items-center gap-2 border-2 border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-sm hover:bg-mad-vermillion/20"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Auto-posting may be paused: scheduled posts might not go out on time.
        </Link>
      ) : null}
    </div>
  )
}
