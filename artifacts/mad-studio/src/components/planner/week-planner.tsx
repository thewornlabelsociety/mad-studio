"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  Plus,
} from "lucide-react"

import { ComingUp } from "@/components/planner/coming-up"
import { getCampaignPlans } from "@/lib/actions"
import { campaignStepsOn, type CampaignPlan } from "@/lib/planner/campaign-recipes"
import { momentsOnDay } from "@/lib/planner/nz-moments"
import { TodayToolLinks } from "@/components/today/today-tool-links"
import { PlatformIcon } from "@/components/ui/app-icons"
import { fetchCalendarPosts, type CalendarPost } from "@/lib/planner/calendar-posts"
import {
  addDays,
  gridPosts,
  mondayOf,
  OPEN_WEEK_RHYTHM,
  planWeek,
  WLS_WEEK_RHYTHM,
  type PlannedDay,
} from "@/lib/planner/week-rhythm"
import { cn } from "@/lib/utils"

/** A grid tile's picture, or its title when the image can't load (expired or a video). */
function GridImage({ src, title, dim }: { src: string; title: string; dim: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="flex size-full items-center justify-center bg-neutral-100 p-2 text-center text-[11px] leading-snug text-neutral-600">
        {title}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", dim && "opacity-80")}
    />
  )
}

/** How far back to look for posts already on the grid. */
const GRID_LOOKBACK_DAYS = 63

const STATE_LABEL: Record<PlannedDay["state"], string> = {
  posted: "Posted",
  planned: "Planned",
  failed: "Didn't post",
  empty: "Empty",
}

function dayLabel(date: Date): { weekday: string; date: string } {
  return {
    weekday: date.toLocaleDateString("en-NZ", { weekday: "short" }).toUpperCase(),
    date: date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" }),
  }
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })
}

function weekLabel(start: Date): string {
  const end = addDays(start, 6)
  const format = (date: Date) => date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" })
  return `${format(start)} – ${format(end)}`
}

/**
 * One week at a glance: the Instagram grid as it will look by Sunday, and the
 * week's rhythm with what's planned, posted, or still to make.
 */
export function WeekPlanner({ entityId, isWornLabel }: { entityId: string; isWornLabel: boolean }) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [posts, setPosts] = useState<CalendarPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rhythm = isWornLabel ? WLS_WEEK_RHYTHM : OPEN_WEEK_RHYTHM
  const query = `?eid=${encodeURIComponent(entityId)}`

  // Campaign days (from the Campaigns page) as pills on each day.
  const [campaigns, setCampaigns] = useState<CampaignPlan[]>([])
  useEffect(() => {
    if (!isWornLabel) return
    let live = true
    void (async () => {
      const result = (await getCampaignPlans({ entityId })) as { ok: boolean; data?: { plans: CampaignPlan[] } }
      if (live && result.ok && result.data) setCampaigns(result.data.plans)
    })()
    return () => {
      live = false
    }
  }, [entityId, isWornLabel])

  const load = useCallback(async () => {
    setPosts(null)
    setError(null)
    try {
      setPosts(
        await fetchCalendarPosts({
          entityId,
          from: addDays(weekStart, -GRID_LOOKBACK_DAYS),
          to: addDays(weekStart, 7),
        })
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't load the week.")
    }
  }, [entityId, weekStart])

  useEffect(() => {
    void load()
  }, [load])

  const days = useMemo(
    () => (posts ? planWeek({ weekStart, posts, rhythm }) : []),
    [posts, weekStart, rhythm]
  )
  const grid = useMemo(
    () => (posts ? gridPosts({ posts, until: addDays(weekStart, 7) }) : []),
    [posts, weekStart]
  )
  const needed = days.filter((day) => !day.slot.optional)
  const covered = needed.filter((day) => day.state !== "empty").length
  const thisWeek = mondayOf(new Date()).getTime() === weekStart.getTime()
  const now = Date.now()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <header className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            {thisWeek ? "This week" : weekStart.getTime() > now ? "Coming up" : "Past week"}
          </p>
          <h1 className="brand-typewriter text-xl">Week of {weekLabel(weekStart)}</h1>
          {posts ? (
            <p className="mt-1 text-sm text-mad-black/70">
              {covered} of {needed.length} feed posts planned
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
            title="Previous week"
            aria-label="Previous week"
            className="flex size-9 items-center justify-center border-2 border-mad-black/30 hover:border-mad-black"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {!thisWeek ? (
            <button
              type="button"
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="h-9 border-2 border-mad-black/30 px-3 text-xs hover:border-mad-black"
            >
              This week
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setWeekStart((current) => addDays(current, 7))}
            title="Next week"
            aria-label="Next week"
            className="flex size-9 items-center justify-center border-2 border-mad-black/30 hover:border-mad-black"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </header>

      {error ? (
        <p className="mx-auto mt-4 max-w-6xl border-2 border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mx-auto mt-5 grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section aria-labelledby="grid-heading" className="grid content-start gap-2">
          <h2 id="grid-heading" className="font-typewriter text-xs uppercase tracking-widest">
            Your grid by Sunday
          </h2>
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-md">
            <div className="grid grid-cols-3 gap-0.5 bg-black/5">
              {posts === null
                ? Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="aspect-[4/5] animate-pulse bg-black/5" />
                  ))
                : grid.length === 0
                  ? (
                      <p className="col-span-3 bg-white px-4 py-10 text-center text-sm text-mad-black/60">
                        No Instagram posts from MAD Studio yet.
                      </p>
                    )
                  : grid.map((post) => {
                      // Judge by the Instagram post itself; another platform may have failed.
                      const upcoming = !post.slots.some(
                        (slot) => slot.platform === "instagram_feed" && slot.status === "published"
                      )
                      return (
                        <div key={post.key} className="relative aspect-[4/5] overflow-hidden bg-white">
                          <GridImage src={post.mediaUrls[0]} title={post.title} dim={upcoming} />
                          {post.mediaUrls.length > 1 ? (
                            <Layers className="absolute right-1.5 top-1.5 size-3.5 text-white drop-shadow" aria-label="Carousel" />
                          ) : null}
                          {upcoming ? (
                            <span className="absolute inset-0 flex items-end justify-start border-2 border-dashed border-white/90 p-1.5">
                              <span className="flex items-center gap-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                                <Clock className="size-3" aria-hidden />
                                {dayLabel(post.time).weekday}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
            </div>
          </div>
          <p className="text-[11px] text-mad-black/55">
            Newest first, as Instagram shows it. Dashed tiles are planned.
            Only posts made in MAD Studio appear here.
          </p>
        </section>

        <section aria-labelledby="rhythm-heading" className="grid content-start gap-2">
          <h2 id="rhythm-heading" className="font-typewriter text-xs uppercase tracking-widest">
            The week
          </h2>
          {posts === null ? (
            <p className="flex items-center gap-2 py-6 text-sm text-mad-black/60">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the week…
            </p>
          ) : (
            <ol className="grid gap-2">
              {days.map((day) => {
                const label = dayLabel(day.date)
                const past = addDays(day.date, 1).getTime() < now
                return (
                  <li
                    key={day.date.toISOString()}
                    className={cn(
                      "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 border-2 bg-white px-3 py-2.5",
                      day.state === "failed"
                        ? "border-mad-vermillion"
                        : day.state === "empty" && !day.slot.optional && !past
                          ? "border-dashed border-mad-black/40"
                          : "border-mad-black/15"
                    )}
                  >
                    <div className="leading-tight">
                      <p className="font-typewriter text-xs font-bold tracking-widest">{label.weekday}</p>
                      <p className="text-[11px] text-mad-black/55">{label.date}</p>
                    </div>

                    <div className="flex min-w-0 items-center gap-3">
                      {day.posts.length > 0 ? (
                        <div className="flex shrink-0 -space-x-3">
                          {day.posts.slice(0, 3).map((post) =>
                            post.mediaUrls[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={post.key}
                                src={post.mediaUrls[0]}
                                alt=""
                                className="h-12 w-10 rounded-sm border-2 border-white object-cover shadow-sm"
                              />
                            ) : null
                          )}
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{day.slot.title}</p>
                        {momentsOnDay(day.date).length > 0 || campaignStepsOn(campaigns, day.date).length > 0 ? (
                          <div className="mb-0.5 mt-0.5 flex flex-wrap gap-1">
                            {campaignStepsOn(campaigns, day.date).map(({ plan, step }) => (
                              <Link
                                key={step.id}
                                href={`/campaigns?eid=${encodeURIComponent(entityId)}`}
                                title={`${plan.name}: ${step.detail}`}
                                className={cn(
                                  "rounded-full border px-2 py-px text-[10px] font-medium leading-4",
                                  step.done
                                    ? "border-mad-black/20 text-mad-black/45 line-through"
                                    : "border-mad-black bg-white text-mad-black"
                                )}
                              >
                                {plan.name}: {step.title}
                              </Link>
                            ))}
                            {momentsOnDay(day.date).map((moment) => (
                              <Link
                                key={moment.id}
                                href={`/dates?eid=${encodeURIComponent(entityId)}`}
                                title={moment.why}
                                className={cn(
                                  "rounded-full px-2 py-px text-[10px] font-medium leading-4",
                                  moment.kind === "school"
                                    ? "bg-[#D7C4A6]/60 text-mad-black"
                                    : moment.kind === "sale"
                                      ? "bg-mad-black text-mad-white"
                                      : "bg-mad-lime/50 text-mad-black"
                                )}
                              >
                                {moment.name}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                        <p className="truncate text-xs text-mad-black/60">
                          {day.posts.length > 0
                            ? day.posts
                                .map((post) => `${timeLabel(post.time)} · ${post.title}`)
                                .join("  ·  ")
                            : day.slot.detail}
                        </p>
                        {day.posts.length > 0 ? (
                          <p className="mt-0.5 flex gap-1 text-mad-black/50">
                            {[...new Set(day.posts.flatMap((post) => post.slots.map((slot) => slot.platform)))].map(
                              (platform) => (
                                <PlatformIcon key={platform} platform={platform} className="size-3" aria-label={platform} />
                              )
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          day.state === "posted" && "bg-emerald-100 text-emerald-800",
                          day.state === "planned" && "bg-mad-black text-mad-white",
                          day.state === "failed" && "bg-mad-vermillion/15 text-mad-vermillion",
                          day.state === "empty" && "bg-black/5 text-mad-black/55"
                        )}
                      >
                        {day.state === "posted" ? <Check className="size-3" aria-hidden /> : null}
                        {day.state === "planned" ? <Clock className="size-3" aria-hidden /> : null}
                        {day.state === "failed" ? <AlertTriangle className="size-3" aria-hidden /> : null}
                        {day.slot.optional && day.state === "empty" ? "Optional" : STATE_LABEL[day.state]}
                      </span>
                      {day.state === "empty" && !past ? (
                        <Link
                          href={`${day.slot.path}${query}`}
                          title={`Make ${day.slot.title.toLowerCase()}`}
                          aria-label={`Make ${day.slot.title.toLowerCase()} for ${label.weekday}`}
                          className="flex size-8 items-center justify-center border-2 border-mad-black hover:bg-mad-black hover:text-mad-white"
                        >
                          <Plus className="size-4" aria-hidden />
                        </Link>
                      ) : day.posts.length > 0 ? (
                        <Link
                          href={`/planner${query}`}
                          title="Open in the calendar"
                          aria-label={`Open ${label.weekday} in the calendar`}
                          className="flex size-8 items-center justify-center border-2 border-mad-black/30 hover:border-mad-black"
                        >
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
          {isWornLabel ? (
            <p className="text-[11px] text-mad-black/55">
              New arrival Stories run every day alongside this from Today&apos;s Stories.
            </p>
          ) : null}
        </section>
      </div>

      {isWornLabel ? (
        <div className="mx-auto mt-8 max-w-6xl">
          <ComingUp entityId={entityId} />
        </div>
      ) : null}

      {isWornLabel ? (
        <section aria-labelledby="make-heading" className="mx-auto mt-8 grid max-w-6xl gap-2">
          <h2 id="make-heading" className="font-typewriter text-xs uppercase tracking-widest">
            Make a post
          </h2>
          <TodayToolLinks entityId={entityId} exclude={["/week"]} />
        </section>
      ) : null}
    </div>
  )
}
