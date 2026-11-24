"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { CalendarCheck, Check, Loader2, RefreshCw, Scissors, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { DotSpecialArt, useDotSpecial, useSecondDotSpecial } from "@/components/templates/dot-special"
import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import { OpeningHoursStory, type TodayHours } from "@/components/templates/opening-hours-slides"
import { todayFromWebsite } from "@/components/templates/wls-opening-hours-workspace"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { saveDayDrafts } from "@/lib/planner/day-drafts"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { createClient } from "@/lib/supabase/client"
import {
  chunkFrames,
  groupByVibe,
  percentOffOf,
  pickArrivals,
  pickSale,
  setPostTime,
} from "@/lib/templates/daily-story-set"
import { pieceType, useStoryCardStyle } from "@/lib/templates/story-card-style"
import { bakeStoryPng, useKitStories, type KitStory } from "@/lib/templates/use-kit-stories"
import { nzDateKey, parseWebsiteHours, type WebsiteContact } from "@/lib/templates/wls-opening-hours"
import { useBrandSetting } from "@/lib/use-brand-setting"
import { cn } from "@/lib/utils"
import { dotDiscountLine } from "@/lib/templates/dot-specials"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

type Mode = "manual" | "auto"

/** The kind the set's posts are saved under, one per batch of up to 10 frames. */
const SET_KIND = "daily_story_set"

function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

type Frame = { id: string; label: string; render: (ref: (node: HTMLDivElement | null) => void) => ReactNode }

/**
 * Today's Story set, built from what's in the shop: today's hours, up to 10
 * new arrivals grouped by vibe, the week's dot specials, then up to 5 pieces
 * at 25% off and 5 at 50% off. Manual: check it and approve. Auto: it books
 * itself for 8am when the app is opened. Posts as Instagram and Facebook Stories.
 */
export function DailyStorySet({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [mode, setMode] = useBrandSetting<Mode>(entityId, "daily_story_mode", `mad.dailyStoryMode.${entityId}`, "manual")
  const [cardStyle] = useStoryCardStyle(entityId)
  const [firstDot] = useDotSpecial(entityId)
  const [secondDot] = useSecondDotSpecial(entityId)
  const [dotBackgroundId] = useBrandSetting<string | null>(
    entityId,
    "dot_special_background",
    `mad.dotSpecial.${entityId}.background`,
    "charcoal"
  )
  const todayKey = nzDateKey()
  // Frames left out today; tomorrow starts fresh.
  const [left, setLeft] = useState<Set<string>>(new Set())
  const [contact, setContact] = useState<WebsiteContact | null>(null)
  const [booked, setBooked] = useState<{ status: "scheduled" | "posted"; at: Date } | null | undefined>(undefined)
  const [booking, setBooking] = useState(false)
  const autoTried = useRef(false)
  const nodes = useRef<Record<string, HTMLDivElement | null>>({})

  // Cutouts only for the pieces in the set (the list comes first).
  const [cutoutIds, setCutoutIds] = useState<string[]>([])
  const { kit, eligible, loaded, stories, cutoutFailed } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: true,
    cutoutIds,
  })

  const pieces = useMemo(
    () =>
      eligible.map((row) => ({
        id: row.marketingEntityId,
        wasPrice: row.wasPrice ?? null,
        price: row.price,
        discountedAt: row.discountedAt ?? null,
        storySharedAt: row.usage.storySharedAt ?? null,
      })),
    [eligible]
  )
  const arrivalIds = useMemo(() => pickArrivals(pieces, 10).map((p) => p.id), [pieces])
  const sale = useMemo(() => pickSale(pieces, 5), [pieces])
  useEffect(() => {
    const ids = [...arrivalIds, ...sale.quarter.map((p) => p.id), ...sale.half.map((p) => p.id)]
    setCutoutIds((current) => (current.join() === ids.join() ? current : ids))
  }, [arrivalIds, sale])

  const storyOf = useCallback((id: string) => stories.get(id) ?? null, [stories])
  const arrivals = useMemo(
    () => groupByVibe(arrivalIds.map(storyOf).filter((s): s is KitStory => s != null), (s) => s.vibe),
    [arrivalIds, storyOf]
  )
  const quarter = sale.quarter.map((p) => storyOf(p.id)).filter((s): s is KitStory => s != null)
  const half = sale.half.map((p) => storyOf(p.id)).filter((s): s is KitStory => s != null)

  // Today's hours from the website.
  useEffect(() => {
    let live = true
    void fetch("/api/website/opening-hours")
      .then((response) => response.json())
      .then((payload: { contact?: WebsiteContact }) => {
        if (live && payload.contact) setContact(payload.contact)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])
  const hours: TodayHours | null = useMemo(
    () => (contact ? todayFromWebsite(parseWebsiteHours(contact), todayKey) : null),
    [contact, todayKey]
  )
  const location = contact ? parseWebsiteHours(contact).location : ""

  // Whether today's set is already booked or out.
  const checkBooked = useCallback(async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const { data } = await createClient()
      .from("scheduled_posts")
      .select("status, scheduled_time")
      .eq("entity_id", entityId)
      .like("payload->>draft_kind", `${SET_KIND}%`)
      .neq("status", "cancelled")
      .gte("scheduled_time", start.toISOString())
      .lt("scheduled_time", end.toISOString())
      .order("scheduled_time", { ascending: true })
    const rows = (data ?? []) as Array<{ status: string; scheduled_time: string }>
    if (rows.length === 0) return setBooked(null)
    setBooked({
      status: rows.every((row) => row.status === "published") ? "posted" : "scheduled",
      at: new Date(rows[0].scheduled_time),
    })
  }, [entityId])
  useEffect(() => {
    void checkBooked()
  }, [checkBooked])

  const kitBackground = (id: string) => kit.find((bg) => bg.id === id) ?? kit[0]
  const hoursBackground = kitBackground("charcoal")
  const dotBackground = kitBackground(dotBackgroundId ?? "charcoal")

  const pieceFrame = (story: KitStory, tag: string, onSale: boolean): Frame => ({
    id: story.row.marketingEntityId,
    label: story.designer ?? "Piece",
    render: (ref) => (
      <KitStoryCanvas
        ref={ref}
        background={story.background}
        brandName={entityName}
        tag={tag}
        imageUrl={story.cutoutUrl || cutoutFailed[story.row.marketingEntityId] ? story.imageUrl : null}
        vibe={story.vibe}
        designer={story.designer}
        sizeLabel={story.sizeLabel}
        categoryLabel={pieceType(story.row.title, story.row.brand)}
        priceLabel={story.priceLabel}
        priceLine={onSale && story.row.wasPrice != null ? { was: money(story.row.wasPrice), now: money(Number(story.row.price)) } : null}
        percentOff={onSale && story.row.wasPrice != null ? percentOffOf(story.row.wasPrice, Number(story.row.price)) : null}
        cardStyle={cardStyle}
        showLinkGuide={false}
      />
    ),
  })

  const frames: Array<Frame & { section: string }> = [
    ...(hours
      ? [
          {
            id: "hours",
            section: "Hours",
            label: `${hours.kicker} ${hours.day}`,
            render: (ref: (node: HTMLDivElement | null) => void) => (
              <OpeningHoursStory
                ref={ref}
                background={hoursBackground}
                brandName={entityName}
                post={{ mode: "today", today: hours, location }}
                linkSpace={false}
              />
            ),
          },
        ]
      : []),
    ...arrivals.map((story) => ({ ...pieceFrame(story, "New in", false), section: "New arrivals" })),
    ...[firstDot, ...(secondDot.on ? [secondDot] : [])].map((dot, index) => ({
      id: `dot-${index}`,
      section: "Dot specials",
      label: `${dot.color.toLowerCase()} dot ${dotDiscountLine(dot.discount)}`,
      render: (ref: (node: HTMLDivElement | null) => void) => (
        <DotSpecialArt ref={ref} special={dot} background={dotBackground} brandName={entityName} aspect="story" />
      ),
    })),
    ...quarter.map((story) => ({ ...pieceFrame(story, "Sale", true), section: "25% off" })),
    ...half.map((story) => ({ ...pieceFrame(story, "Sale", true), section: "50% off" })),
  ]
  const included = frames.filter((frame) => !left.has(frame.id))
  // Ready once every piece in the set has its cutout (or has given up on one).
  const waiting = [...arrivals, ...quarter, ...half].filter(
    (story) => !story.cutoutUrl && !cutoutFailed[story.row.marketingEntityId]
  ).length
  const ready = loaded && contact != null && waiting === 0 && included.length > 0

  async function book(how: Mode) {
    if (booking) return
    setBooking(true)
    try {
      const urls: string[] = []
      for (const frame of included) {
        const node = nodes.current[frame.id]
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length === 0) throw new Error("The Stories aren't ready yet.")
      const start = setPostTime(new Date(), 8)
      const batches = chunkFrames(urls, 10)
      await saveDayDrafts({
        entityId,
        day: start,
        status: "scheduled",
        drafts: batches.map((batch, index) => ({
          kind: `${SET_KIND}_${index + 1}`,
          platforms: ["instagram_story", "facebook_story"],
          title: batches.length > 1 ? `Today's Stories (${index + 1} of ${batches.length})` : "Today's Stories",
          caption: "",
          mediaUrls: batch,
          hour: start.getHours(),
          // A minute apart, so the batches go up in order.
          time: new Date(start.getTime() + index * 60 * 1000),
        })),
      })
      toast.success(
        `${urls.length} Stories booked for ${start.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })} on Instagram and Facebook${how === "auto" ? " (automatically)" : ""}.`
      )
      await checkBooked()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't book today's Stories.")
    } finally {
      setBooking(false)
    }
  }

  // Auto: once the set is ready and nothing is booked today, book it (once per visit).
  useEffect(() => {
    if (mode !== "auto" || autoTried.current || booked !== null || !ready) return
    autoTried.current = true
    // A beat for the photos to paint before they're saved.
    const timer = window.setTimeout(() => void book("auto"), 1500)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, booked, ready])

  const status =
    booked === undefined
      ? "Checking…"
      : booked
        ? booked.status === "posted"
          ? "Posted today"
          : `Booked for ${booked.at.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}`
        : !loaded || contact == null
          ? "Getting today's set ready…"
          : waiting > 0
            ? `Cutting out ${waiting} piece${waiting === 1 ? "" : "s"}…`
            : mode === "auto"
              ? "Booking automatically…"
              : "Ready to approve"

  let lastSection = ""
  return (
    <section aria-labelledby="daily-set-heading" className="grid gap-3 border-2 border-mad-black bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="daily-set-heading" className="flex items-center gap-1.5 font-typewriter text-xs font-bold uppercase tracking-widest">
            <Sparkles className="size-3.5" aria-hidden /> Today&apos;s Story set
          </h2>
          <p className="mt-0.5 text-xs text-mad-black/60">
            {included.length} frames · Instagram and Facebook Stories · {status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border-2 border-mad-black" role="group" aria-label="How today's set goes out">
            {(
              [
                { id: "manual", label: "Manual", hint: "Check it, then approve" },
                { id: "auto", label: "Auto", hint: "Books itself for 8am when the app is opened" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                aria-pressed={mode === option.id}
                title={option.hint}
                className={cn(
                  "h-8 px-3 font-typewriter text-[0.7rem] font-bold uppercase tracking-wider",
                  mode === option.id ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {booked ? (
            <span className="inline-flex h-8 items-center gap-1.5 bg-emerald-100 px-2.5 text-xs font-medium text-emerald-800">
              <Check className="size-3.5" aria-hidden /> {status}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void book("manual")}
              disabled={!ready || booking || booked === undefined}
              className="inline-flex h-8 items-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 font-typewriter text-[0.7rem] font-bold uppercase tracking-wider text-mad-white hover:bg-mad-vermillion disabled:opacity-40"
            >
              {booking ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CalendarCheck className="size-3.5" aria-hidden />}
              {booking
                ? "Booking…"
                : `Approve for ${setPostTime(new Date(), 8).toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" })}`}
            </button>
          )}
        </div>
      </div>

      {frames.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-mad-black/60">
          <RefreshCw className="size-4 animate-spin" aria-hidden /> Getting today&apos;s set ready…
        </p>
      ) : (
        <ol className="flex gap-3 overflow-x-auto pb-2">
          {frames.map((frame) => {
            const out = left.has(frame.id)
            const heading = frame.section !== lastSection ? frame.section : null
            lastSection = frame.section
            const story = stories.get(frame.id)
            const cutting = story && !story.cutoutUrl && !cutoutFailed[frame.id]
            return (
              <li key={frame.id} className="flex w-[120px] shrink-0 flex-col gap-1">
                <span className="h-4 truncate font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
                  {heading ?? ""}
                </span>
                <div className={cn("relative overflow-hidden rounded-sm shadow-md", out && "opacity-30")}>
                  {frame.render((node) => {
                    nodes.current[frame.id] = node
                  })}
                  {cutting ? (
                    <div className="absolute inset-x-0 top-1/3 flex justify-center text-white">
                      <Scissors className="size-4 animate-pulse" aria-hidden />
                    </div>
                  ) : null}
                </div>
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    checked={!out}
                    disabled={booked != null}
                    onChange={() =>
                      setLeft((current) => {
                        const next = new Set(current)
                        if (next.has(frame.id)) next.delete(frame.id)
                        else next.add(frame.id)
                        return next
                      })
                    }
                  />
                  <span className="truncate">In the set</span>
                </label>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
