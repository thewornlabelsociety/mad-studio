"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, Loader2, RefreshCw, RotateCcw, Share2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import {
  OpeningHoursCard,
  OpeningHoursStory,
  type HoursPost,
  type TodayHours,
} from "@/components/templates/opening-hours-slides"
import { Button } from "@/components/ui/button"
import { resolveStoryKit } from "@/lib/brands/story-kit"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { bakeStoryPng, shareOrDownloadStory } from "@/lib/templates/use-kit-stories"
import {
  DAY_NAMES,
  DAY_SHORT,
  dateFromKey,
  dayLabel,
  holidaysInWeek,
  nzDateKey,
  parseWebsiteHours,
  planForDay,
  publicHolidayOn,
  weekRows,
  type WebsiteContact,
  type WeekHours,
} from "@/lib/templates/wls-opening-hours"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

type Mode = "today" | "week"

/** The day's words as the website's hours say them. */
function todayFromWebsite(week: WeekHours, key: string): TodayHours {
  const date = dateFromKey(key)
  const plan = planForDay(week, date)
  const { day, date: dateText } = dayLabel(date)
  const base = { day, date: dateText }
  if (plan.holiday) {
    const hours = plan.hours ? (plan.hours.closed ? "Closed" : plan.hours.hours) : ""
    // The website doesn't give holiday hours, so the usual ones start the post and the page asks for a check.
    return { ...base, kicker: plan.holiday, hours, note: "" }
  }
  if (!plan.hours) return { ...base, kicker: "Today", hours: "", note: "" }
  if (plan.hours.closed) {
    const next = plan.nextOpen
    const tomorrow = next && Math.round((next.date.getTime() - date.getTime()) / 86_400_000) === 1
    const when = next ? (tomorrow ? "tomorrow" : DAY_NAMES[next.date.getDay()]) : ""
    return { ...base, kicker: "Today", hours: "Closed", note: next ? `Back ${when} ${next.hours.hours}` : "" }
  }
  return { ...base, kicker: "Open today", hours: plan.hours.hours, note: plan.hours.note }
}

/** Holidays in the coming week, or the website's holiday line. */
function weekFootnote(week: WeekHours, key: string): string {
  const holidays = holidaysInWeek(dateFromKey(key))
  if (holidays.length === 0) return week.holidayNote
  const names = holidays.map(([name, date]) => `${name} ${DAY_SHORT[date.getDay()]} ${date.getDate()}`).join(", ")
  return `${names}: hours may vary`
}

function draftKey(entityId: string): string {
  return `mad.opening-hours.${entityId}`
}

/** Opening hours from the website: today's hours as a Story, or the week's. */
export function WlsOpeningHoursWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const storyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [contact, setContact] = useState<WebsiteContact | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>("today")
  const [dateKey, setDateKey] = useState(() => nzDateKey())
  // Changed words, by day; anything not changed follows the website.
  const [todayEdits, setTodayEdits] = useState<Record<string, Partial<TodayHours>>>({})
  const [footnoteEdit, setFootnoteEdit] = useState<string | null>(null)
  const [backgroundId, setBackgroundId] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(draftKey(entityId))
    } catch {
      return null
    }
  })
  const [linkSpace, setLinkSpace] = useState(false)
  const [busy, setBusy] = useState<"story" | "studio" | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/website/opening-hours")
      const payload = (await response.json().catch(() => ({}))) as { contact?: WebsiteContact; error?: string }
      if (!response.ok || !payload.contact) throw new Error(payload.error || "Couldn't reach the website.")
      setContact(payload.contact)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Couldn't reach the website.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    try {
      if (backgroundId) window.localStorage.setItem(draftKey(entityId), backgroundId)
    } catch {
      /* the colour just isn't remembered */
    }
  }, [entityId, backgroundId])

  const kit = useMemo(
    () =>
      resolveStoryKit({
        presets: resolveVisualPresets({ brandName: entityName, industry, brandIdentity: brandIdentity as never }),
        isWornLabel: true,
      }),
    [entityName, industry, brandIdentity]
  )
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit.find((bg) => bg.id === "charcoal") ?? kit[0]

  const week = useMemo(() => (contact ? parseWebsiteHours(contact) : null), [contact])
  const rows = useMemo(() => (week ? weekRows(week) : []), [week])
  const fromWebsite = useMemo(() => (week ? todayFromWebsite(week, dateKey) : null), [week, dateKey])
  const today = fromWebsite ? { ...fromWebsite, ...todayEdits[dateKey] } : null
  const footnote = footnoteEdit ?? (week ? weekFootnote(week, dateKey) : "")
  const location = week?.location ?? ""
  const missingDay = week != null && week.days[dateFromKey(dateKey).getDay()] == null
  const holiday = week ? publicHolidayOn(dateFromKey(dateKey)) : null

  const post: HoursPost | null =
    mode === "today"
      ? today && { mode: "today", today, location }
      : week && { mode: "week", rows, footnote, location }

  function editToday<K extends keyof TodayHours>(key: K, value: TodayHours[K]) {
    setTodayEdits((current) => ({ ...current, [dateKey]: { ...current[dateKey], [key]: value } }))
  }
  const edited = mode === "today" ? Object.keys(todayEdits[dateKey] ?? {}).length > 0 : footnoteEdit != null
  function resetToWebsite() {
    if (mode === "today") setTodayEdits(({ [dateKey]: _, ...rest }) => rest)
    else setFootnoteEdit(null)
  }

  function caption(): string {
    if (!post) return ""
    if (post.mode === "today") {
      const t = post.today
      return [
        [t.kicker, `${t.day} ${t.date}`].filter((part) => part.trim()).join(", "),
        t.hours,
        t.note,
        "",
        location,
      ].filter((line, index, lines) => line.trim() || (index > 0 && lines[index - 1].trim())).join("\n").trim()
    }
    return [
      "Our opening hours",
      "",
      ...post.rows.map((row) => `${row.label}: ${row.closed ? "Closed" : row.hours}${row.note ? ` (${row.note})` : ""}`),
      "",
      post.footnote,
      location,
    ].join("\n").replace(/\n{3,}/g, "\n\n").trim()
  }

  const fileStem = mode === "today" ? `wls-hours-${dateKey}` : "wls-hours-week"

  async function saveStory() {
    if (!storyRef.current) return
    setBusy("story")
    try {
      const baked = await bakeStoryPng(storyRef.current)
      if ((await shareOrDownloadStory({ ...baked, filename: `${fileStem}.png` })) === "downloaded") {
        toast.success("Story image saved.")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setBusy(null)
    }
  }

  async function sendCard() {
    if (!cardRef.current) return
    setBusy("studio")
    try {
      const { blob } = await bakeStoryPng(cardRef.current)
      const url = await uploadRenderedPng(blob, entityId)
      saveStudioSlidesHandoff(entityId, { urls: [url], caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the card.")
      setBusy(null)
    }
  }

  const field = "h-9 w-full border-2 border-mad-black bg-white px-2 text-sm"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            From the website · Story and feed card
          </p>
          <h1 className="brand-typewriter text-xl">Opening hours</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Reads the hours on your website&apos;s Contact page. Post today&apos;s hours as a Story, or the
            week&apos;s hours to the feed. Change any words for a holiday or a one-off.
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Background">
          {kit.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => setBackgroundId(bg.id)}
              title={bg.name}
              aria-label={`Use ${bg.name}`}
              aria-pressed={bg.id === background.id}
              className={cn(
                "relative size-8 rounded-full border border-black/15",
                bg.id === background.id && "ring-2 ring-mad-black ring-offset-2"
              )}
              style={{ background: bg.color }}
            >
              {bg.id === background.id ? (
                <Check className="absolute inset-0 m-auto size-3.5" style={{ color: bg.text_color }} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      </header>

      {loading && !contact ? (
        <div className="flex items-center gap-2 py-16 text-sm text-mad-black/70">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reading the hours from the website…
        </div>
      ) : loadError && !contact ? (
        <div className="grid max-w-xl gap-2 border-2 border-mad-vermillion/40 bg-red-50 px-4 py-4 text-sm text-red-950">
          <p className="font-semibold">Couldn&apos;t read the hours from the website</p>
          <p>{loadError}</p>
          <Button type="button" size="sm" variant="outline" className="justify-self-start border-2 border-mad-black" onClick={() => void load()}>
            <RefreshCw className="mr-2 size-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      ) : week && post ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <section aria-labelledby="hours-words" className="grid content-start gap-3">
            <div className="flex border-2 border-mad-black" role="group" aria-label="Post">
              {(["today", "week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={cn(
                    "flex-1 px-3 py-1.5 font-typewriter text-xs uppercase tracking-widest",
                    mode === option ? "bg-mad-black text-mad-white" : "bg-white hover:bg-mad-lime/40"
                  )}
                >
                  {option === "today" ? "One day" : "The week"}
                </button>
              ))}
            </div>

            <h2 id="hours-words" className="sr-only">Words</h2>
            {mode === "today" ? (
              <>
                <label className="grid gap-1 text-xs">
                  <span className="font-typewriter uppercase tracking-widest">Day</span>
                  <input
                    id="hours-date"
                    type="date"
                    className={field}
                    value={dateKey}
                    onChange={(e) => e.target.value && setDateKey(e.target.value)}
                  />
                </label>
                {missingDay ? (
                  <p className="flex items-start gap-1.5 text-xs text-mad-black/70">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    The website doesn&apos;t list hours for {DAY_NAMES[dateFromKey(dateKey).getDay()]}. Type them below.
                  </p>
                ) : null}
                {holiday ? (
                  <p className="flex items-start gap-1.5 border-2 border-mad-black/15 bg-white p-2 text-xs text-mad-black/80">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      {holiday} is a public holiday. These are the usual {DAY_NAMES[dateFromKey(dateKey).getDay()]} hours
                      {week.holidayNote ? <> (the website says &ldquo;{week.holidayNote}&rdquo;)</> : null}: check them before posting.
                    </span>
                  </p>
                ) : null}
                {today && fromWebsite ? (
                  <>
                    <label className="grid gap-1 text-xs">
                      <span className="font-typewriter uppercase tracking-widest">Above the day</span>
                      <input id="hours-kicker" className={field} value={today.kicker} maxLength={30} onChange={(e) => editToday("kicker", e.target.value)} />
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-typewriter uppercase tracking-widest">Hours</span>
                      <input
                        id="hours-hours"
                        className={field}
                        value={today.hours}
                        maxLength={24}
                        placeholder="e.g. 10am – 5pm, or Closed"
                        onChange={(e) => editToday("hours", e.target.value)}
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      <span className="font-typewriter uppercase tracking-widest">Line under the hours</span>
                      <input
                        id="hours-note"
                        className={field}
                        value={today.note}
                        maxLength={48}
                        placeholder="e.g. Late night"
                        onChange={(e) => editToday("note", e.target.value)}
                      />
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <div className="grid gap-1 border-2 border-mad-black/15 bg-white p-2.5 text-xs">
                  <span className="font-typewriter uppercase tracking-widest">From the website</span>
                  {rows.map((row) => (
                    <div key={row.label} className="flex justify-between gap-3">
                      <span className="text-mad-black/70">{row.label}</span>
                      <span className={row.closed ? "text-mad-black/50" : ""}>
                        {row.closed ? "Closed" : row.hours}
                        {row.note ? ` · ${row.note}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <label className="grid gap-1 text-xs">
                  <span className="font-typewriter uppercase tracking-widest">Line under the hours</span>
                  <input
                    id="hours-footnote"
                    className={field}
                    value={footnote}
                    maxLength={80}
                    placeholder="e.g. Public holidays may vary"
                    onChange={(e) => setFootnoteEdit(e.target.value)}
                  />
                </label>
              </>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={resetToWebsite}
                disabled={!edited}
                className="inline-flex items-center gap-1.5 border border-mad-black/30 px-2.5 py-1 text-xs hover:border-mad-black disabled:opacity-40"
              >
                <RotateCcw className="size-3" aria-hidden />
                Back to the website&apos;s words
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                title="Read the hours from the website again"
                className="inline-flex items-center gap-1.5 border border-mad-black/30 px-2.5 py-1 text-xs hover:border-mad-black disabled:opacity-40"
              >
                <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden />
                Refresh hours
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input id="hours-link-space" type="checkbox" checked={linkSpace} onChange={(e) => setLinkSpace(e.target.checked)} />
              Leave space on the Story for a link sticker
            </label>
          </section>

          <section aria-labelledby="hours-previews" className="grid content-start gap-3">
            <h2 id="hours-previews" className="font-typewriter text-xs uppercase tracking-widest">
              Story and feed card
            </h2>
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex w-[230px] flex-col gap-2">
                <OpeningHoursStory
                  background={background}
                  brandName={entityName}
                  post={post}
                  linkSpace={linkSpace}
                  className="rounded-md shadow-md"
                />
                <Button
                  type="button"
                  className="border-2 border-mad-black bg-mad-black text-mad-white"
                  disabled={busy != null}
                  onClick={() => void saveStory()}
                >
                  {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
                  Save Story image
                </Button>
              </div>
              <div className="flex w-[300px] flex-col gap-2">
                <OpeningHoursCard
                  background={background}
                  brandName={entityName}
                  post={post}
                  className="rounded-sm shadow-md"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="border-2 border-mad-black"
                  disabled={busy != null}
                  onClick={() => void sendCard()}
                  title="Open the card in Studio to schedule it"
                >
                  {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                  Send card to Studio
                </Button>
              </div>
            </div>
          </section>

          {/* Full-size copies for saving, without the preview's rounded corners; never shown. */}
          <div aria-hidden className="pointer-events-none fixed -left-[10000px] top-0 flex gap-4" data-export-ignore="true">
            <div className="w-[230px]">
              <OpeningHoursStory ref={storyRef} background={background} brandName={entityName} post={post} linkSpace={linkSpace} />
            </div>
            <div className="w-[300px]">
              <OpeningHoursCard ref={cardRef} background={background} brandName={entityName} post={post} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
