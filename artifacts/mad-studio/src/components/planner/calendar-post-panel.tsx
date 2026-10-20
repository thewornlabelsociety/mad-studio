"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { CalendarClock, EyeOff, Loader2, Pencil, Send, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { PlatformIcon } from "@/components/ui/app-icons"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  cancelScheduledPost,
  hideCalendarPosts,
  pushScheduledPostNow,
  rescheduleScheduledPost,
} from "@/lib/actions"
import {
  plannedMove,
  type CalendarPost,
  type CalendarPostStatus,
} from "@/lib/planner/calendar-posts"
import { cn } from "@/lib/utils"

export const STATUS_STYLES: Record<CalendarPostStatus, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-mad-black text-mad-white" },
  processing: { label: "Posting…", className: "bg-amber-300 text-mad-black" },
  published: { label: "Posted", className: "bg-emerald-600 text-mad-white" },
  failed: { label: "Failed", className: "bg-mad-vermillion text-mad-white" },
  cancelled: { label: "Cancelled", className: "bg-neutral-300 text-mad-black" },
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram_story: "IG Story",
  instagram_feed: "IG Feed",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  email: "VIP email",
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.replace(/_/g, " ")
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

type Props = {
  entityId: string
  post: CalendarPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a move or unschedule so the calendar reloads. */
  onChanged: () => void
}

/**
 * One post from the calendar: the finished artwork and caption, where and
 * when it goes, and quick fixes — move it, edit it in Studio, or unschedule.
 */
export function CalendarPostPanel({ entityId, post, open, onOpenChange, onChanged }: Props) {
  const [when, setWhen] = useState("")
  const [busy, setBusy] = useState<"move" | "cancel" | "now" | "hide" | null>(null)

  useEffect(() => {
    if (post) setWhen(toLocalInput(post.time))
  }, [post])

  if (!post) return null
  const editable = post.slots.filter((slot) => slot.status === "scheduled" || slot.status === "failed")

  async function move() {
    if (!post) return
    const target = new Date(when)
    if (Number.isNaN(target.getTime())) {
      toast.error("Pick a date and time.")
      return
    }
    // Keep each platform's spacing: shift every slot by the same amount.
    // Checked up front so a post never ends up split across two times.
    const delta = target.getTime() - post.time.getTime()
    const plan = plannedMove(post, (time) => new Date(time.getTime() + delta))
    if (plan.error) {
      toast.error(plan.error)
      return
    }
    setBusy("move")
    try {
      for (const move of plan.moves) {
        const result = (await rescheduleScheduledPost({
          entityId,
          postId: move.id,
          scheduledTime: move.time.toISOString(),
        })) as { ok?: boolean; error?: string }
        if (!result?.ok) throw new Error(result?.error ?? "Couldn't move this post.")
      }
      toast.success("Moved")
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't move this post.")
    } finally {
      setBusy(null)
    }
  }

  async function postNow() {
    if (!post) return
    if (!window.confirm("Post this now on every platform it's set for?")) return
    setBusy("now")
    try {
      for (const slot of editable) {
        const result = (await pushScheduledPostNow({ entityId, postId: slot.id })) as {
          ok?: boolean
          error?: string
        }
        if (!result?.ok) throw new Error(result?.error ?? "Couldn't post this now.")
      }
      toast.success("Sent — it'll show as Posted once each platform confirms")
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't post this now.")
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  async function hide() {
    if (!post) return
    setBusy("hide")
    try {
      const result = (await hideCalendarPosts({
        entityId,
        postIds: post.slots.map((slot) => slot.id),
      })) as { ok?: boolean; error?: string }
      if (!result?.ok) throw new Error(result?.error ?? "Couldn't hide this post.")
      toast.success("Hidden from the calendar — it's still live on the platform")
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't hide this post.")
    } finally {
      setBusy(null)
    }
  }

  async function unschedule() {
    if (!post) return
    const onlyFailed = editable.every((slot) => slot.status === "failed")
    if (
      !window.confirm(
        onlyFailed
          ? "Dismiss this failed post? It won't be retried."
          : "Unschedule this post? It won't go out."
      )
    )
      return
    setBusy("cancel")
    try {
      for (const slot of editable) {
        const result = (await cancelScheduledPost({ entityId, postId: slot.id })) as {
          ok?: boolean
          error?: string
        }
        if (!result?.ok) throw new Error(result?.error ?? "Couldn't unschedule.")
      }
      toast.success("Unscheduled")
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't unschedule.")
    } finally {
      setBusy(null)
    }
  }

  const status = post.overdue
    ? { label: "Overdue", className: "bg-amber-300 text-mad-black" }
    : STATUS_STYLES[post.status]
  const onlyFailed = editable.length > 0 && editable.every((slot) => slot.status === "failed")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l-2 border-mad-black bg-mad-white sm:max-w-md">
        <SheetHeader className="border-b-2 border-mad-black pb-3 text-left">
          <span
            className={cn(
              "w-fit px-1.5 py-0.5 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase",
              status.className
            )}
          >
            {status.label}
          </span>
          <SheetTitle className="font-typewriter text-sm font-bold tracking-wide uppercase">
            {post.title}
          </SheetTitle>
          <p className="text-xs text-neutral-600">
            {post.time.toLocaleString("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {post.overdue ? (
            <p className="border-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-mad-black">
              This should have gone out already. Auto-posting may be paused —
              use Post now, or move it to a new time.
            </p>
          ) : null}
          {post.mediaUrls.length > 0 ? (
            <div className="flex snap-x gap-2 overflow-x-auto pb-1">
              {post.mediaUrls.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Slide ${index + 1}`}
                  className="h-52 w-auto shrink-0 snap-start border-2 border-mad-black object-contain"
                />
              ))}
            </div>
          ) : null}

          {post.caption ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
              {post.caption}
            </p>
          ) : null}

          <ul className="divide-y divide-neutral-200 border-2 border-mad-black">
            {post.slots.map((slot) => (
              <li key={slot.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                <PlatformIcon platform={slot.platform} className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{platformLabel(slot.platform)}</p>
                  <p className="text-xs text-neutral-600">
                    {(slot.publishedAt ?? slot.time).toLocaleString("en-NZ", {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {slot.error ? ` · ${slot.error}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 px-1.5 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase",
                    STATUS_STYLES[slot.status].className
                  )}
                >
                  {STATUS_STYLES[slot.status].label}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            {post.campaignId ? (
              <Link
                href={`/studio?eid=${encodeURIComponent(entityId)}&pack_id=${encodeURIComponent(post.campaignId)}`}
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit in Studio
              </Link>
            ) : null}

            {editable.length > 0 ? (
              <>
                <div className="flex items-end gap-2">
                  <label className="grid flex-1 gap-1">
                    <span className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">
                      Move to
                    </span>
                    <input
                      type="datetime-local"
                      value={when}
                      onChange={(event) => setWhen(event.target.value)}
                      className="h-10 border-2 border-mad-black px-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void move()}
                    className="inline-flex h-10 items-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
                  >
                    {busy === "move" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <CalendarClock className="size-3.5" aria-hidden />
                    )}
                    Move
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void postNow()}
                    className="inline-flex items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime disabled:opacity-40"
                  >
                    {busy === "now" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Send className="size-3.5" aria-hidden />
                    )}
                    {onlyFailed ? "Retry now" : "Post now"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void unschedule()}
                    className="inline-flex items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-vermillion hover:text-mad-white disabled:opacity-40"
                  >
                    {busy === "cancel" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : onlyFailed ? (
                      <X className="size-3.5" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                    {onlyFailed ? "Dismiss" : "Unschedule"}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-neutral-500">
                {post.status === "published"
                  ? "Already posted — it can't be moved."
                  : "This post is going out now."}
              </p>
            )}
            {post.status === "published" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void hide()}
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime disabled:opacity-40"
              >
                {busy === "hide" ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <EyeOff className="size-3.5" aria-hidden />
                )}
                Hide from calendar
              </button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
