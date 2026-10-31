"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Link } from "wouter"
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Loader2,
  Plus,
  Sparkles,
  Wand2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  CalendarPostPanel,
  STATUS_STYLES,
} from "@/components/planner/calendar-post-panel"
import {
  addDays,
  buildDayCell,
  buildMonthGrid,
  buildWeekRow,
  isSameDay,
  plannerWeekdayLabels,
  startOfWeekMonday,
  type PlannerCalendarView,
} from "@/components/planner/planner-calendar-utils"
import { PlatformIcon } from "@/components/ui/app-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  archiveCampaignProgram,
  rescheduleScheduledPost,
  skipCampaignProgramDay,
} from "@/lib/actions"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import { artDirectorPicks, type ArtDirectorPick } from "@/lib/brain/team"
import {
  dayKey,
  fetchCalendarPosts,
  moveToDay,
  plannedMove,
  type CalendarPost,
} from "@/lib/planner/calendar-posts"
import type { PlannerTimelineDay } from "@/lib/planner/planner-timeline-types"
import { fetchNewArrivalSuggestions } from "@/lib/studio/new-arrival-suggestions"
import { prepareCampaignStep } from "@/components/campaigns/campaign-planner"
import {
  DayPills,
  datePillsOn,
  SharedStoriesChip,
  useCampaignPlans,
  useSharedStories,
} from "@/components/planner/day-pills"
import { ymd } from "@/lib/planner/campaign-recipes"
import type { SharedStory } from "@/lib/planner/campaign-progress"
import { campaignStepsOn, type CampaignPlan } from "@/lib/planner/campaign-recipes"
import { WLS_WEEK_RHYTHM } from "@/lib/planner/week-rhythm"
import { useLocation } from "wouter"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const VIEW_OPTIONS: { id: PlannerCalendarView; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
]

type Props = {
  entityId: string
  anchorDate: Date
  timeline: PlannerTimelineDay[]
  onSelectDay: (day: PlannerTimelineDay) => void
  /** Extra controls at the start of the toolbar (e.g. Campaign planner). */
  toolbarStart?: ReactNode
  /** The campaign plan shown as "Planned" beats, if any. */
  programId?: string | null
  onPlanChanged?: (change: { kind: "cleared" } | { kind: "day-removed"; dayId: string }) => void
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function rangeFor(view: PlannerCalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const from = startOfDay(anchor)
    return { from, to: addDays(from, 1) }
  }
  if (view === "week") {
    const from = startOfWeekMonday(anchor)
    return { from, to: addDays(from, 7) }
  }
  const cells = buildMonthGrid(anchor)
  return { from: cells[0].date, to: addDays(cells[cells.length - 1].date, 1) }
}

function rangeTitle(view: PlannerCalendarView, anchor: Date): string {
  if (view === "month") {
    return anchor.toLocaleDateString("en-NZ", { month: "long", year: "numeric" })
  }
  if (view === "day") {
    return anchor.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })
  }
  const from = startOfWeekMonday(anchor)
  const to = addDays(from, 6)
  const sameMonth = from.getMonth() === to.getMonth()
  return `${from.getDate()}${sameMonth ? "" : ` ${from.toLocaleDateString("en-NZ", { month: "short" })}`} – ${to.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}`
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })
}

function isEditable(post: CalendarPost): boolean {
  return post.slots.some((slot) => slot.status === "scheduled" || slot.status === "failed")
}

/**
 * The editorial calendar: what's actually going out (and what went out),
 * with campaign plans as a lighter layer. Week view is a board you can
 * drag posts across; empty days offer the Art director's picks.
 */
export function PlannerCalendarCanvas({
  entityId,
  anchorDate,
  timeline,
  onSelectDay,
  toolbarStart = null,
  programId = null,
  onPlanChanged,
}: Props) {
  const [view, setView] = useState<PlannerCalendarView>("week")
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()))
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropKey, setDropKey] = useState<string | null>(null)
  const [picks, setPicks] = useState<ArtDirectorPick[]>([])
  const [isWls, setIsWls] = useState(false)
  // Campaign days and NZ dates show on every day.
  const campaigns = useCampaignPlans(entityId, isWls)

  // Jump to a campaign when one is generated or opened.
  useEffect(() => {
    setAnchor(startOfDay(anchorDate))
  }, [anchorDate])

  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor])
  const sharedStories = useSharedStories({ entityId, from, to, enabled: isWls })

  // Only the latest request wins, so quick Next/Previous clicks never show
  // another week's posts.
  const loadToken = useRef(0)
  const load = useCallback(async () => {
    const token = ++loadToken.current
    setLoading(true)
    try {
      const next = await fetchCalendarPosts({ entityId, from, to })
      if (token === loadToken.current) setPosts(next)
    } catch (error) {
      if (token === loadToken.current) {
        toast.error(error instanceof Error ? error.message : "Couldn't load posts.")
      }
    } finally {
      if (token === loadToken.current) setLoading(false)
    }
  }, [entityId, from, to])

  useEffect(() => {
    void load()
  }, [load])

  // The Art director's picks, for filling empty days.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await createClient()
          .from("entities")
          .select("name, industry")
          .eq("id", entityId)
          .maybeSingle()
        const isFashion =
          resolveIndustryProfile({ name: data?.name ?? "", industry: data?.industry ?? "" }).id ===
          "worn_label"
        if (!cancelled) setIsWls(isFashion)
        const suggestions = await fetchNewArrivalSuggestions({ entityId, isFashion, limit: 24 })
        if (!cancelled) {
          setPicks(artDirectorPicks({ items: suggestions.map((row) => row.item), isFashion, max: 4 }))
        }
      } catch {
        if (!cancelled) setPicks([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entityId])

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>()
    for (const post of posts) {
      const key = dayKey(post.time)
      map.set(key, [...(map.get(key) ?? []), post])
    }
    return map
  }, [posts])

  const timelineByDay = useMemo(() => {
    const map = new Map<string, PlannerTimelineDay>()
    for (const day of timeline) map.set(dayKey(day.date), day)
    return map
  }, [timeline])

  const cells = useMemo(() => {
    if (view === "day") return buildDayCell(anchor)
    if (view === "week") return buildWeekRow(anchor)
    return buildMonthGrid(anchor)
  }, [anchor, view])

  const today = startOfDay(new Date())
  const selected = posts.find((post) => post.key === selectedKey) ?? null

  function step(direction: -1 | 1) {
    setAnchor((current) => {
      if (view === "day") return addDays(current, direction)
      if (view === "week") return addDays(current, 7 * direction)
      return new Date(current.getFullYear(), current.getMonth() + direction, 1)
    })
  }

  function openPost(post: CalendarPost) {
    setSelectedKey(post.key)
    setPanelOpen(true)
  }

  async function dropOn(day: Date) {
    const post = posts.find((row) => row.key === dragKey)
    setDragKey(null)
    setDropKey(null)
    if (!post || isSameDay(post.time, day)) return
    if (startOfDay(day) < today) {
      toast.error("Pick today or a later day.")
      return
    }
    const plan = plannedMove(post, (time) => moveToDay(time, day))
    if (plan.error) {
      toast.error(plan.error)
      return
    }
    try {
      for (const move of plan.moves) {
        const result = (await rescheduleScheduledPost({
          entityId,
          postId: move.id,
          scheduledTime: move.time.toISOString(),
        })) as { ok?: boolean; error?: string }
        if (!result?.ok) throw new Error(result?.error ?? "Couldn't move this post.")
      }
      toast.success(
        `Moved to ${day.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short" })}`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't move this post.")
    } finally {
      void load()
    }
  }

  async function removePlannedDay(beat: PlannerTimelineDay) {
    if (!window.confirm(`Remove "${beat.phase}" from the plan?`)) return
    const result = (await skipCampaignProgramDay({ entityId, dayId: beat.id })) as {
      ok?: boolean
      error?: string
    }
    if (!result?.ok) {
      toast.error(result?.error ?? "Couldn't remove that planned day.")
      return
    }
    onPlanChanged?.({ kind: "day-removed", dayId: beat.id })
    toast.success("Removed from the plan")
  }

  async function clearPlan() {
    if (!programId) return
    if (
      !window.confirm(
        "Clear this campaign plan from the calendar? Posts it already scheduled stay scheduled."
      )
    )
      return
    const result = (await archiveCampaignProgram({ entityId, programId })) as {
      ok?: boolean
      error?: string
    }
    if (!result?.ok) {
      toast.error(result?.error ?? "Couldn't clear the plan.")
      return
    }
    onPlanChanged?.({ kind: "cleared" })
    toast.success("Plan cleared")
  }

  const dropProps = (day: Date) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!dragKey) return
      event.preventDefault()
      setDropKey(dayKey(day))
    },
    onDragLeave: () => setDropKey((key) => (key === dayKey(day) ? null : key)),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      void dropOn(day)
    },
  })

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-mad-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-mad-black px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {toolbarStart}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="inline-flex size-8 items-center justify-center border-2 border-mad-black hover:bg-mad-lime"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="h-8 border-y-2 border-mad-black px-2.5 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="inline-flex size-8 items-center justify-center border-2 border-mad-black hover:bg-mad-lime"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <p className="font-typewriter text-sm font-bold tracking-widest text-mad-black uppercase">
            {rangeTitle(view, anchor)}
          </p>
          {loading ? <Loader2 className="size-4 animate-spin text-neutral-500" aria-label="Loading" /> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {programId && timeline.length > 0 ? (
            <button
              type="button"
              onClick={() => void clearPlan()}
              title="Remove the campaign plan's Planned days from the calendar"
              className="inline-flex items-center gap-1.5 border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-vermillion hover:text-mad-white"
            >
              <X className="size-3.5" aria-hidden />
              Clear plan
            </button>
          ) : null}
          {VIEW_OPTIONS.map((option) => {
            const active = view === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={active}
                className={cn(
                  "border-2 border-mad-black px-3 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase transition-colors",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap-sm"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          cells={cells}
          today={today}
          postsByDay={postsByDay}
          timelineByDay={timelineByDay}
          onOpenPost={openPost}
          onSelectDay={onSelectDay}
          entityId={entityId}
          campaigns={campaigns}
          picks={picks}
          isWls={isWls}
          sharedStories={sharedStories}
          onOpenDay={(date) => {
            setAnchor(startOfDay(date))
            setView("week")
          }}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div
            className="grid min-h-full"
            style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(${view === "day" ? "18rem" : "9.5rem"}, 1fr))` }}
          >
            {cells.map((cell) => {
              const key = dayKey(cell.date)
              const dayPosts = postsByDay.get(key) ?? []
              const beat = timelineByDay.get(key)
              const isToday = isSameDay(cell.date, today)
              const past = startOfDay(cell.date) < today
              return (
                <div
                  key={key}
                  {...dropProps(cell.date)}
                  className={cn(
                    "flex min-h-[24rem] flex-col gap-2 border-r-2 border-mad-black p-2 last:border-r-0",
                    past && "bg-neutral-50",
                    dropKey === key && "bg-mad-lime/25"
                  )}
                >
                  <div className="flex items-baseline justify-between">
                    <p className="font-typewriter text-[0.72rem] font-bold tracking-wider text-neutral-500 uppercase">
                      {cell.date.toLocaleDateString("en-NZ", { weekday: "short" })}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {!past && dayPosts.length > 0 ? (
                        <FillDay corner picks={picks} entityId={entityId} date={cell.date} isWls={isWls} campaigns={campaigns} />
                      ) : null}
                      <p
                        className={cn(
                          "font-typewriter text-sm font-bold tabular-nums",
                          isToday && "bg-mad-black px-1.5 text-mad-white"
                        )}
                      >
                        {cell.date.getDate()}
                      </p>
                    </div>
                  </div>

                  <DayPills date={cell.date} entityId={entityId} campaigns={campaigns} />
                  <SharedStoriesChip stories={sharedStories.get(ymd(cell.date))} entityId={entityId} />

                  {beat ? (
                    <div className="group/beat relative">
                      <button
                        type="button"
                        onClick={() => onSelectDay(beat)}
                        className="w-full border-2 border-dashed border-neutral-400 p-1.5 pr-6 text-left hover:border-mad-black"
                      >
                        <p className="font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">
                          Planned · {beat.phase}
                        </p>
                        <p className="line-clamp-2 text-[0.75rem] leading-snug text-neutral-600">
                          {beat.directorialAction}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removePlannedDay(beat)}
                        aria-label={`Remove ${beat.phase} from the plan`}
                        title="Remove from the plan"
                        className="absolute top-1 right-1 inline-flex size-5 items-center justify-center border border-neutral-400 bg-mad-white text-neutral-500 hover:border-mad-black hover:text-mad-black"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  ) : null}

                  {dayPosts.map((post) => (
                    <PostCard
                      key={post.key}
                      post={post}
                      large={view === "day"}
                      onOpen={() => openPost(post)}
                      onDragStart={() => setDragKey(post.key)}
                      onDragEnd={() => {
                        setDragKey(null)
                        setDropKey(null)
                      }}
                    />
                  ))}

                  {dayPosts.length === 0 && !past ? (
                    <FillDay picks={picks} entityId={entityId} date={cell.date} isWls={isWls} campaigns={campaigns} />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <CalendarPostPanel
        entityId={entityId}
        post={selected}
        open={panelOpen}
        onOpenChange={setPanelOpen}
        onChanged={() => void load()}
      />
    </section>
  )
}

function PostCard({
  post,
  large = false,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  post: CalendarPost
  large?: boolean
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const draggable = isEditable(post)
  const status = post.overdue
    ? { label: "Overdue", className: "bg-amber-300 text-mad-black" }
    : STATUS_STYLES[post.status]
  const platforms = [...new Set(post.slots.map((slot) => slot.platform))]
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", post.key)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      title={draggable ? "Click to open · drag to another day" : "Click to open"}
      className={cn(
        "group relative flex w-full flex-col border-2 border-mad-black bg-mad-white text-left shadow-keycap-sm hover:bg-mad-lime/15",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-neutral-100", large ? "aspect-[4/5]" : "aspect-square")}>
        {post.mediaUrls[0] ? (
          <img src={post.mediaUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
        ) : null}
        <span
          className={cn(
            "absolute top-1 left-1 px-1 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase",
            status.className
          )}
        >
          {status.label}
        </span>
        {post.mediaUrls.length > 1 ? (
          <span className="absolute top-1 right-1 bg-mad-black/75 px-1 font-typewriter text-[0.68rem] font-bold text-mad-white">
            1/{post.mediaUrls.length}
          </span>
        ) : null}
        {draggable ? (
          <GripVertical className="absolute right-1 bottom-1 size-4 text-mad-white opacity-0 drop-shadow group-hover:opacity-100" aria-hidden />
        ) : null}
      </div>
      <div className="space-y-0.5 p-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="font-typewriter text-[0.7rem] font-bold tabular-nums">{timeLabel(post.time)}</span>
          <span className="flex gap-0.5">
            {platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} className="size-3" />
            ))}
          </span>
        </div>
        <p className="line-clamp-2 text-[0.75rem] leading-snug font-semibold text-mad-black">{post.title}</p>
      </div>
    </button>
  )
}

/** Ideas for an empty day: what's planned or on that day, the week's slot, then new arrivals. */
function FillDay({
  picks,
  entityId,
  date,
  isWls,
  campaigns,
  corner = false,
}: {
  picks: ArtDirectorPick[]
  entityId: string
  date: Date
  isWls: boolean
  campaigns: CampaignPlan[]
  /** A small + in the day's corner instead of the big Fill this day box. */
  corner?: boolean
}) {
  const [, navigate] = useLocation()
  const eid = encodeURIComponent(entityId)
  const steps = isWls ? campaignStepsOn(campaigns, date) : []
  const moments = isWls ? datePillsOn(campaigns, date) : []
  // Monday first, matching the Week planner's rhythm.
  const slot = isWls ? WLS_WEEK_RHYTHM[(date.getDay() + 6) % 7] : null
  const heading = "font-typewriter text-[0.68rem] font-bold tracking-widest text-neutral-500 uppercase"
  const row = "flex items-center gap-2 px-3 py-2"
  const make =
    "inline-flex shrink-0 items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-1 font-typewriter text-[0.68rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion"

  return (
    <Popover>
      <PopoverTrigger asChild>
        {corner ? (
          <button
            type="button"
            title="Ideas for this day"
            aria-label={`Ideas for ${date.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-mad-black/40 bg-white text-mad-black/70 hover:border-mad-black hover:bg-mad-lime hover:text-mad-black"
          >
            <Plus className="size-3" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="mt-1 flex min-h-24 w-full flex-col items-center justify-center gap-1 border-2 border-dashed border-neutral-300 p-3 text-center text-neutral-500 hover:border-mad-black hover:text-mad-black"
          >
            <Plus className="size-4" aria-hidden />
            <span className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">
              Fill this day
            </span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto rounded-none border-2 border-mad-black p-0">
        <p className="flex items-center gap-1.5 border-b-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
          <Sparkles className="size-3.5" aria-hidden />
          Ideas for {date.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "short" })}
        </p>

        {steps.length > 0 || moments.length > 0 ? (
          <div className="border-b border-neutral-200 py-1">
            <p className={cn(heading, "px-3 pt-1")}>On this day</p>
            {steps.map(({ plan, step }) => (
              <div key={step.id} className={row}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{step.title}</p>
                  <p className="truncate text-[0.75rem] text-neutral-600">{plan.name} campaign</p>
                </div>
                <button type="button" onClick={() => navigate(prepareCampaignStep(step, entityId, plan.id))} className={make}>
                  Make it
                </button>
              </div>
            ))}
            {moments.map((moment) => (
              <div key={moment.id} className={row}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{moment.name}</p>
                  <p className="line-clamp-2 text-[0.75rem] leading-snug text-neutral-600">{moment.ideas[0]}</p>
                </div>
                <Link href={`/templates/wls-announcement?eid=${eid}&moment=${encodeURIComponent(moment.id)}`} className={make}>
                  Card
                </Link>
              </div>
            ))}
          </div>
        ) : null}

        {slot ? (
          <div className="border-b border-neutral-200 py-1">
            <p className={cn(heading, "px-3 pt-1")}>Your week</p>
            <div className={row}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{slot.title}</p>
                <p className="truncate text-[0.75rem] text-neutral-600">{slot.detail}</p>
              </div>
              <Link href={`${slot.path}?eid=${eid}`} className={make}>
                Make it
              </Link>
            </div>
          </div>
        ) : null}

        <p className={cn(heading, "px-3 pt-2")}>From new arrivals</p>
        {picks.length === 0 ? (
          <p className="px-3 py-3 text-xs text-neutral-600">
            No new arrivals to suggest right now.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200">
            {picks.map((pick) => {
              const cover = pick.items[0]?.images.find((url) => /^https?:\/\//i.test(url))
              const params = new URLSearchParams({
                eid: entityId,
                step: "2",
                fresh: "1",
                items: pick.items.map((item) => item.id).join(","),
                format: pick.format,
              })
              // A single piece is a kit Story; a group goes to Studio as a carousel or reel.
              const href =
                isWls && pick.format === "story" && pick.items[0]
                  ? `/templates/wls-daily-story?eid=${eid}&item=${encodeURIComponent(pick.items[0].id)}`
                  : `/studio?${params.toString()}`
              return (
                <li key={pick.id} className={row}>
                  {cover ? (
                    <img src={cover} alt="" className="size-10 shrink-0 border border-mad-black object-cover" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{pick.title}</p>
                    <p className="line-clamp-2 text-[0.75rem] leading-snug text-neutral-600">{pick.reason}</p>
                  </div>
                  <Link href={href} className={make}>
                    <Wand2 className="size-3" aria-hidden />
                    Build
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function MonthGrid({
  cells,
  today,
  postsByDay,
  timelineByDay,
  onOpenPost,
  onSelectDay,
  onOpenDay,
  entityId,
  campaigns,
  picks,
  isWls,
  sharedStories,
}: {
  entityId: string
  campaigns: CampaignPlan[]
  picks: ArtDirectorPick[]
  isWls: boolean
  sharedStories: Map<string, SharedStory[]>
  cells: Array<{ date: Date; inCurrentMonth: boolean }>
  today: Date
  postsByDay: Map<string, CalendarPost[]>
  timelineByDay: Map<string, PlannerTimelineDay>
  onOpenPost: (post: CalendarPost) => void
  onSelectDay: (day: PlannerTimelineDay) => void
  onOpenDay: (date: Date) => void
}) {
  return (
    <>
      <div className="grid shrink-0 grid-cols-7 border-b-2 border-mad-black">
        {plannerWeekdayLabels().map((label) => (
          <div
            key={label}
            className="border-r-2 border-mad-black px-2 py-1.5 text-center font-typewriter text-[0.7rem] font-bold tracking-wider text-neutral-500 uppercase last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 overflow-auto"
        style={{ gridTemplateRows: `repeat(${Math.ceil(cells.length / 7)}, minmax(5.5rem, 1fr))` }}
      >
        {cells.map((cell) => {
          const key = dayKey(cell.date)
          const dayPosts = postsByDay.get(key) ?? []
          const beat = timelineByDay.get(key)
          const isToday = isSameDay(cell.date, today)
          return (
            <div
              key={key}
              className={cn(
                "flex min-w-0 flex-col gap-1 overflow-hidden border-r-2 border-b-2 border-mad-black p-1.5 [&:nth-child(7n)]:border-r-0",
                !cell.inCurrentMonth && "bg-neutral-50"
              )}
            >
              <div className="flex items-center justify-between gap-1">
                {cell.date >= today ? (
                  <FillDay corner picks={picks} entityId={entityId} date={cell.date} isWls={isWls} campaigns={campaigns} />
                ) : (
                  <span aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => onOpenDay(cell.date)}
                  title="Open this week"
                  className={cn(
                    "font-typewriter text-[0.75rem] font-bold tabular-nums hover:underline",
                    cell.inCurrentMonth ? "text-mad-black" : "text-neutral-400",
                    isToday && "bg-mad-black px-1 text-mad-white"
                  )}
                >
                  {cell.date.getDate()}
                </button>
              </div>
              <DayPills date={cell.date} entityId={entityId} campaigns={campaigns} compact />
              <SharedStoriesChip stories={sharedStories.get(ymd(cell.date))} entityId={entityId} compact />
              {beat ? (
                <button
                  type="button"
                  onClick={() => onSelectDay(beat)}
                  className="truncate border border-dashed border-neutral-400 px-1 text-left font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase hover:border-mad-black"
                >
                  Planned · {beat.phase}
                </button>
              ) : null}
              {dayPosts.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {dayPosts.slice(0, 4).map((post) => (
                    <button
                      key={post.key}
                      type="button"
                      onClick={() => onOpenPost(post)}
                      title={`${timeLabel(post.time)} · ${post.title}`}
                      className="relative size-9 shrink-0 overflow-hidden border-2 border-mad-black bg-neutral-100"
                    >
                      {post.mediaUrls[0] ? (
                        <img src={post.mediaUrls[0]} alt="" loading="lazy" className="size-full object-cover" />
                      ) : null}
                      <span
                        className={cn(
                          "absolute right-0 bottom-0 size-2 border border-mad-white",
                          STATUS_STYLES[post.status].className
                        )}
                        aria-label={STATUS_STYLES[post.status].label}
                      />
                    </button>
                  ))}
                  {dayPosts.length > 4 ? (
                    <span className="self-center font-typewriter text-[0.68rem] font-bold text-neutral-600">
                      +{dayPosts.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </>
  )
}
