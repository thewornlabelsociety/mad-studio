"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { CalendarClock, Check, EyeOff, Loader2, Pencil, Send, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { DotSpecialDraftEditor } from "@/components/planner/dot-special-draft-editor"
import { PlatformIcon } from "@/components/ui/app-icons"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  cancelScheduledPost,
  hideCalendarPosts,
  pushScheduledPostNow,
  rescheduleScheduledPost,
} from "@/lib/actions"
import { approveDrafts, discardDrafts } from "@/lib/planner/day-drafts"
import { postTypeById } from "@/components/planner/post-types"
import {
  plannedMove,
  type CalendarPost,
  type CalendarPostStatus,
} from "@/lib/planner/calendar-posts"
import { cn } from "@/lib/utils"

export const STATUS_STYLES: Record<CalendarPostStatus, { label: string; className: string }> = {
  draft: { label: "Needs approval", className: "bg-mad-lime text-mad-black" },
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

/** The second tap for an action that can't be taken back. */
function ConfirmBar({
  message,
  yes,
  onYes,
  onNo,
}: {
  message: string
  yes: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div role="alertdialog" aria-label={message} className="grid gap-2 border-2 border-mad-vermillion bg-mad-vermillion/10 p-3">
      <p className="text-sm font-medium text-mad-black">{message}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          autoFocus
          onClick={onYes}
          className="inline-flex items-center justify-center gap-2 border-2 border-mad-vermillion bg-mad-vermillion px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-black hover:border-mad-black"
        >
          <Check className="size-3.5" aria-hidden />
          {yes}
        </button>
        <button
          type="button"
          onClick={onNo}
          className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-white px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
        >
          <X className="size-3.5" aria-hidden />
          Keep it
        </button>
      </div>
    </div>
  )
}

type Props = {
  entityId: string
  /** For artwork drawn in the drawer (the dot special draft). */
  brandName: string
  post: CalendarPost | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a move or unschedule so the calendar reloads. */
  onChanged: () => void
  /** Reopens a draft's post type in the side drawer for its day. */
  onEditDraft?: (typeId: string, day: Date) => void
}

/**
 * One post from the calendar: the finished artwork and caption, where and
 * when it goes, and quick fixes — move it, edit it in Studio, or unschedule.
 */
export function CalendarPostPanel({ entityId, brandName, post, open, onOpenChange, onChanged, onEditDraft }: Props) {
  const [when, setWhen] = useState("")
  const [busy, setBusy] = useState<"move" | "cancel" | "now" | "hide" | "slot" | "approve" | "discard" | null>(null)
  /** The one platform whose time is being changed on its own. */
  const [slotEdit, setSlotEdit] = useState<{ id: string; when: string } | null>(null)
  /** A draft's caption, editable until it's approved. */
  const [draftCaption, setDraftCaption] = useState("")
  /**
   * The action waiting on a second tap. Asked in the drawer, not with
   * window.confirm, which embedded browsers (previews, webviews) can block
   * silently, leaving the button doing nothing.
   */
  const [confirming, setConfirming] = useState<"now" | "cancel" | "discard" | null>(null)

  useEffect(() => {
    if (post) {
      setWhen(toLocalInput(post.time))
      setDraftCaption(post.caption)
    }
    setSlotEdit(null)
    setConfirming(null)
  }, [post?.key])

  if (!post) return null
  const editable = post.slots.filter((slot) => slot.status === "scheduled" || slot.status === "failed")
  const drafts = post.slots.filter((slot) => slot.status === "draft")
  const isDraft = drafts.length > 0
  // A draft made by a post type reopens in its drawer, for the same day.
  // (The dot special edits right here instead.)
  const draftType = isDraft ? postTypeById(post.draftKind) : null

  async function approve() {
    if (!post) return
    const target = new Date(when)
    if (Number.isNaN(target.getTime())) {
      toast.error("Pick a date and time.")
      return
    }
    setBusy("approve")
    try {
      await approveDrafts({
        entityId,
        ids: drafts.map((slot) => slot.id),
        time: target,
        caption: draftCaption.trim() === post.caption.trim() ? undefined : draftCaption.trim(),
      })
      toast.success(
        `Approved: goes out ${target.toLocaleString("en-NZ", { weekday: "long", hour: "numeric", minute: "2-digit" })}`
      )
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't approve this draft.")
    } finally {
      setBusy(null)
    }
  }

  async function discard() {
    if (!post) return
    setConfirming(null)
    setBusy("discard")
    try {
      await discardDrafts({ entityId, ids: drafts.map((slot) => slot.id) })
      toast.success("Draft discarded")
      onChanged()
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't discard this draft.")
    } finally {
      setBusy(null)
    }
  }

  async function move() {
    if (!post) return
    const target = new Date(when)
    if (Number.isNaN(target.getTime())) {
      toast.error("Pick a date and time.")
      return
    }
    // Every platform goes at the time picked (one platform's own time is its
    // clock button). Checked up front so a post never ends up half moved.
    const plan = plannedMove(post, () => target)
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

  /** Move one platform only (the others keep their times). */
  async function moveSlot() {
    if (!slotEdit) return
    const target = new Date(slotEdit.when)
    if (Number.isNaN(target.getTime())) {
      toast.error("Pick a date and time.")
      return
    }
    if (target.getTime() < Date.now() + 2 * 60 * 1000) {
      toast.error("That time has already passed — pick a later time, or use Post now.")
      return
    }
    setBusy("slot")
    try {
      const result = (await rescheduleScheduledPost({
        entityId,
        postId: slotEdit.id,
        scheduledTime: target.toISOString(),
      })) as { ok?: boolean; error?: string }
      if (!result?.ok) throw new Error(result?.error ?? "Couldn't move this post.")
      toast.success("Moved")
      setSlotEdit(null)
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
    setConfirming(null)
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
    setConfirming(null)
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

          {isDraft ? (
            <p className="border-2 border-mad-black bg-mad-lime/30 px-3 py-2 text-xs text-mad-black">
              A draft for you to check. Nothing goes out until you approve it.
            </p>
          ) : null}

          {isDraft && post.slots.some((slot) => slot.platform !== "instagram_story") ? (
            <label className="grid gap-1">
              <span className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">Caption</span>
              <textarea
                value={draftCaption}
                onChange={(event) => setDraftCaption(event.target.value)}
                rows={8}
                className="w-full border-2 border-mad-black p-2 text-sm leading-relaxed"
              />
            </label>
          ) : post.caption && !isDraft ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-mad-black">
              {post.caption}
            </p>
          ) : null}

          <ul className="divide-y divide-neutral-200 border-2 border-mad-black">
            {post.slots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-start gap-2 px-3 py-2 text-sm">
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
                {slot.status === "scheduled" || slot.status === "failed" ? (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() =>
                      setSlotEdit((current) =>
                        current?.id === slot.id ? null : { id: slot.id, when: toLocalInput(slot.time) }
                      )
                    }
                    title={`Change the ${platformLabel(slot.platform)} time only`}
                    aria-label={`Change the ${platformLabel(slot.platform)} time only`}
                    aria-expanded={slotEdit?.id === slot.id}
                    className={cn(
                      "-my-1 flex size-8 shrink-0 items-center justify-center border-2 border-transparent hover:border-mad-black disabled:opacity-40",
                      slotEdit?.id === slot.id && "border-mad-black bg-mad-lime"
                    )}
                  >
                    <CalendarClock className="size-4" aria-hidden />
                  </button>
                ) : null}
                {slotEdit?.id === slot.id ? (
                  <div className="flex w-full items-center gap-2 pt-1">
                    <input
                      type="datetime-local"
                      value={slotEdit.when}
                      onChange={(event) => setSlotEdit({ id: slot.id, when: event.target.value })}
                      aria-label={`New time for ${platformLabel(slot.platform)}`}
                      className="h-9 min-w-0 flex-1 border-2 border-mad-black px-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void moveSlot()}
                      title="Save this time"
                      aria-label="Save this time"
                      className="flex size-9 shrink-0 items-center justify-center border-2 border-mad-black bg-mad-black text-mad-white hover:bg-mad-vermillion disabled:opacity-40"
                    >
                      {busy === "slot" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                ) : null}
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

            {isDraft ? (
              <>
                {post.draftKind === "dot_special" ? (
                  <DotSpecialDraftEditor
                    key={post.key}
                    entityId={entityId}
                    brandName={brandName}
                    ids={drafts.map((slot) => slot.id)}
                    draftData={post.draftData}
                    onSaved={onChanged}
                  />
                ) : null}
                {draftType && onEditDraft ? (
                  <div className="grid gap-1">
                    <button
                      type="button"
                      onClick={() => onEditDraft(draftType.id, post.time)}
                      className="inline-flex w-full items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Edit {draftType.title.toLowerCase()}
                    </button>
                    <p className="text-[0.75rem] leading-snug text-neutral-600">
                      Opens it in the drawer. Press Add to{" "}
                      {post.time.toLocaleDateString("en-NZ", { weekday: "long" })} there and it replaces this draft.
                    </p>
                  </div>
                ) : null}
                <label className="grid gap-1">
                  <span className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">Goes out</span>
                  <input
                    type="datetime-local"
                    value={when}
                    onChange={(event) => setWhen(event.target.value)}
                    className="h-10 border-2 border-mad-black px-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void approve()}
                    className="inline-flex items-center justify-center gap-2 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
                  >
                    {busy === "approve" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Check className="size-3.5" aria-hidden />
                    )}
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => setConfirming("discard")}
                    className="inline-flex items-center justify-center gap-2 border-2 border-mad-black px-3 py-2 font-typewriter text-[0.72rem] font-bold tracking-wider uppercase hover:bg-mad-vermillion hover:text-mad-white disabled:opacity-40"
                  >
                    {busy === "discard" ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                    Discard
                  </button>
                </div>
                {confirming === "discard" ? (
                  <ConfirmBar
                    message="Discard this draft? It won't go out."
                    yes="Yes, discard"
                    onYes={() => void discard()}
                    onNo={() => setConfirming(null)}
                  />
                ) : null}
              </>
            ) : editable.length > 0 ? (
              <>
                <div className="flex items-end gap-2">
                  <label className="grid flex-1 gap-1">
                    <span className="font-typewriter text-[0.7rem] font-bold tracking-wider uppercase">
                      {post.slots.length > 1 ? "Move all to" : "Move to"}
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
                    onClick={() => setConfirming("now")}
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
                    onClick={() => setConfirming("cancel")}
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
                {confirming === "now" ? (
                  <ConfirmBar
                    message={onlyFailed ? "Try posting this again now?" : "Post this now on every platform it's set for?"}
                    yes={onlyFailed ? "Yes, retry" : "Yes, post now"}
                    onYes={() => void postNow()}
                    onNo={() => setConfirming(null)}
                  />
                ) : null}
                {confirming === "cancel" ? (
                  <ConfirmBar
                    message={onlyFailed ? "Dismiss this failed post? It won't be retried." : "Unschedule this post? It won't go out."}
                    yes={onlyFailed ? "Yes, dismiss" : "Yes, unschedule"}
                    onYes={() => void unschedule()}
                    onNo={() => setConfirming(null)}
                  />
                ) : null}
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
