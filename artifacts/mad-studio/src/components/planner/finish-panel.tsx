"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarCheck, CalendarPlus, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { PlatformIcon } from "@/components/ui/app-icons"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { buildStudioOptimizationTags, mergeCaptionWithTags, normalizeOptTag } from "@/lib/inventory/optimization-tags"
import { dayLabel, saveDayDrafts, ymdOf, parseYmd, type DayDraft } from "@/lib/planner/day-drafts"
import { cn } from "@/lib/utils"

type Channel = DayDraft["platforms"][number]

const CHANNELS: Array<{ id: Channel; label: string; story?: boolean }> = [
  { id: "instagram_feed", label: "Instagram feed" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok photos" },
  { id: "instagram_story", label: "Instagram Story", story: true },
]

/** What a template hands over once its slides are made. */
export type FinishRequest = {
  entityId: string
  /** The post type, e.g. "sale_rack"; a new draft of it replaces that day's last one. */
  kind: string
  title: string
  urls: string[]
  caption: string
  /**
   * The template's Story version, made only if Instagram Story is ticked:
   * one frame, or several shown one after another.
   */
  story?: () => Promise<string[]>
  /** The day to start on (the planner's day in its drawer); today otherwise. */
  day?: Date | null
  /** Default time of day. */
  hour: number
  /** After a save, e.g. close the planner drawer and reload the calendar. */
  onSaved?: () => void
  /** "Open in Studio instead": the old hand-off, for anything the panel can't do. */
  onStudio: () => void
}

export type FinishResult = "saved" | "closed" | "studio"

type Pending = FinishRequest & { resolve: (result: FinishResult) => void }

let open: ((request: Pending) => void) | null = null

/**
 * Opens the finish panel and waits until it closes. Every template ends here:
 * pick the day, time and channels, check the caption and hashtags, then add it
 * as a draft to approve or schedule it.
 */
export function requestFinish(request: FinishRequest): Promise<FinishResult> {
  return new Promise((resolve) => {
    if (!open) {
      // No panel on this page (shouldn't happen inside the app): fall back to Studio.
      request.onStudio()
      resolve("studio")
      return
    }
    open({ ...request, resolve })
  })
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

/**
 * When it starts set to go out. A day picked on the planner keeps that day:
 * its usual hour, or the next whole hour if that has passed. With no day
 * picked, a passed hour moves to tomorrow (not 10pm tonight).
 */
function startTime(day: Date | null, hour: number): Date {
  const base = day ?? new Date()
  const time = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, 0, 0, 0)
  const earliest = Date.now() + 30 * 60 * 1000
  if (time.getTime() >= earliest) return time
  if (!day) {
    time.setDate(time.getDate() + 1)
    return time
  }
  const next = new Date(earliest)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}

/** One copy per page, in the app shell; templates reach it through requestFinish. */
export function FinishPanelHost({ brandName, industry }: { brandName: string; industry?: string | null }) {
  const [request, setRequest] = useState<Pending | null>(null)
  const [dayKey, setDayKey] = useState("")
  const [time, setTime] = useState("11:00")
  const [channels, setChannels] = useState<Channel[]>(["instagram_feed", "facebook"])
  const [caption, setCaption] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")
  const [saving, setSaving] = useState<"draft" | "scheduled" | null>(null)

  useEffect(() => {
    open = (next) => {
      const start = startTime(next.day ?? null, next.hour)
      setDayKey(ymdOf(start))
      setTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`)
      setChannels(["instagram_feed", "facebook"])
      setCaption(next.caption)
      setTags(buildStudioOptimizationTags({ brandName, industry, titleHint: next.title }))
      setNewTag("")
      setSaving(null)
      setRequest(next)
    }
    return () => {
      open = null
    }
  }, [brandName, industry])

  const when = useMemo(() => {
    const day = parseYmd(dayKey)
    const [h, m] = time.split(":").map(Number)
    if (!day || Number.isNaN(h)) return null
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m || 0)
  }, [dayKey, time])

  function close(result: FinishResult) {
    request?.resolve(result)
    setRequest(null)
  }

  function addTag() {
    const tag = normalizeOptTag(newTag)
    if (tag && !tags.includes(tag)) setTags((current) => [...current, tag])
    setNewTag("")
  }

  async function save(status: "draft" | "scheduled") {
    if (!request || !when) return
    if (channels.length === 0) {
      toast.error("Pick at least one place to post.")
      return
    }
    if (status === "scheduled" && when.getTime() < Date.now() + 2 * 60 * 1000) {
      toast.error("That time has passed. Pick a later time to schedule.")
      return
    }
    setSaving(status)
    try {
      const feed = channels.filter((id) => id !== "instagram_story")
      const drafts: DayDraft[] = []
      if (feed.length > 0) {
        drafts.push({
          kind: request.kind,
          platforms: feed,
          title: request.title,
          caption: mergeCaptionWithTags(caption, tags),
          mediaUrls: request.urls,
          hour: when.getHours(),
          time: when,
        })
      }
      // The Story is its own post beside the feed one, made only when ticked.
      if (channels.includes("instagram_story") && request.story) {
        const frames = await request.story()
        if (frames.length === 0) throw new Error("The Story isn't ready yet. Try again in a moment.")
        drafts.push({
          kind: `${request.kind}_story`,
          platforms: ["instagram_story"],
          title: `${request.title} Story`,
          caption: "",
          mediaUrls: frames,
          hour: when.getHours(),
          time: when,
        })
      }
      const { saved } = await saveDayDrafts({ entityId: request.entityId, day: when, status, drafts })
      if (saved.length === 0) {
        toast.message(
          `${dayLabel(when)} already has an approved ${request.title.toLowerCase()}. Unschedule it in the planner, or schedule this one instead.`
        )
        setSaving(null)
        return
      }
      const at = when.toLocaleString("en-NZ", { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      toast.success(status === "draft" ? `Draft added for ${at}. Approve it in the planner.` : `Scheduled for ${at}.`)
      request.onSaved?.()
      close("saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save it.")
      setSaving(null)
    }
  }

  const label = "font-typewriter text-[0.7rem] font-bold tracking-wider uppercase"

  return (
    <Sheet open={request != null} onOpenChange={(next) => (next ? null : close("closed"))}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l-2 border-mad-black bg-mad-white p-0 sm:max-w-md">
        {request ? (
          <>
            <SheetHeader className="border-b-2 border-mad-black px-5 py-3 text-left">
              <SheetTitle className="font-typewriter text-sm font-bold tracking-wide uppercase">{request.title}</SheetTitle>
              <SheetDescription className="text-xs text-neutral-600">
                When and where it goes. Add it as a draft to approve on the planner, or schedule it now.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                {request.urls.map((url, index) => (
                  <img
                    key={`${url}-${index}`}
                    src={url}
                    alt={`Slide ${index + 1}`}
                    className="h-36 w-auto shrink-0 snap-start border-2 border-mad-black object-contain"
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className={label}>Day</span>
                  <input
                    type="date"
                    value={dayKey}
                    onChange={(event) => setDayKey(event.target.value)}
                    className="h-10 border-2 border-mad-black px-2 text-sm"
                  />
                </label>
                <label className="grid gap-1">
                  <span className={label}>Time</span>
                  <input
                    type="time"
                    value={time}
                    step={300}
                    onChange={(event) => setTime(event.target.value)}
                    className="h-10 border-2 border-mad-black px-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid gap-1.5">
                <span className={label}>Post to</span>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.filter((channel) => !channel.story || request.story).map((channel) => {
                    const on = channels.includes(channel.id)
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setChannels((current) =>
                            on ? current.filter((id) => id !== channel.id) : [...current, channel.id]
                          )
                        }
                        className={cn(
                          "flex h-9 items-center gap-1.5 border-2 border-mad-black px-2.5 text-xs",
                          on ? "bg-mad-black text-mad-white" : "border-dashed text-mad-black/70 hover:bg-[#F4EFE6]"
                        )}
                      >
                        <PlatformIcon platform={channel.id} className="size-3.5" />
                        {channel.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className="grid gap-1">
                <span className={label}>Caption</span>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={6}
                  className="w-full border-2 border-mad-black p-2 text-sm leading-relaxed"
                />
              </label>

              <div className="grid gap-1.5">
                <span className={label}>Hashtags</span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="flex h-7 items-center gap-1 rounded-full border border-mad-black/40 pl-2.5 pr-1 text-xs">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setTags((current) => current.filter((t) => t !== tag))}
                        title={`Remove #${tag}`}
                        aria-label={`Remove #${tag}`}
                        className="flex size-5 items-center justify-center rounded-full hover:bg-mad-black hover:text-mad-white"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    value={newTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Add a tag"
                    aria-label="Add a hashtag"
                    className="h-7 w-28 rounded-full border border-dashed border-mad-black/40 px-2.5 text-xs"
                  />
                </div>
                <p className="text-[0.75rem] text-neutral-500">These go under the caption, exactly as shown.</p>
              </div>
            </div>

            <div className="grid gap-2 border-t-2 border-mad-black px-5 py-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={saving != null || !when}
                  onClick={() => void save("draft")}
                  className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
                >
                  {saving === "draft" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CalendarPlus className="size-3.5" aria-hidden />}
                  Add as draft
                </button>
                <button
                  type="button"
                  disabled={saving != null || !when}
                  onClick={() => void save("scheduled")}
                  className="inline-flex items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime disabled:opacity-40"
                >
                  {saving === "scheduled" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CalendarCheck className="size-3.5" aria-hidden />}
                  Schedule
                </button>
              </div>
              <button
                type="button"
                disabled={saving != null}
                onClick={() => {
                  request.onStudio()
                  close("studio")
                }}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-neutral-600 underline-offset-2 hover:underline disabled:opacity-40"
              >
                Open in Studio instead <ArrowRight className="size-3" aria-hidden />
              </button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** Bakes rendered Story cards and uploads them, in order, for a request's `story`. */
export async function bakeStoryFrames(nodes: Array<HTMLElement | null | undefined>, entityId: string): Promise<string[]> {
  const [{ bakeStoryPng }, { uploadRenderedPng }] = await Promise.all([
    import("@/lib/templates/use-kit-stories"),
    import("@/lib/studio/final-artwork"),
  ])
  const urls: string[] = []
  for (const node of nodes.slice(0, 10)) {
    if (!node) continue
    const { blob } = await bakeStoryPng(node)
    urls.push(await uploadRenderedPng(blob, entityId))
  }
  return urls
}
