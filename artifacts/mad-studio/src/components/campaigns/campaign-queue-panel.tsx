"use client"

import { useState } from "react"
import { CalendarClock, Loader2, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  cancelScheduledPost,
  pushScheduledPostNow,
  rescheduleScheduledPost,
  type InventoryActionResult,
} from "@/lib/actions"
import type { CampaignQueuePost } from "@/lib/campaigns/ledger"
import { cn } from "@/lib/utils"

const PLATFORM_LABELS: Record<string, string> = {
  instagram_story: "IG Story",
  instagram_feed: "IG Feed",
  facebook: "Facebook",
  tiktok: "TikTok",
  email: "VIP Email",
}

const EDITABLE = new Set(["scheduled", "failed"])

type ImmediateDispatch = {
  successes: number
  failures: number
  errors: Array<{ error: string }>
  skippedReason?: string
}

/** ISO → value for <input type="datetime-local"> in the viewer's timezone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function statusTone(status: string) {
  if (status === "published") return "bg-mad-lime text-mad-black"
  if (status === "failed") return "bg-mad-vermillion text-mad-white"
  if (status === "processing" || status === "publishing") return "bg-mad-black text-mad-white"
  return "bg-neutral-100 text-mad-black"
}

const actionButton =
  "inline-flex h-7 items-center gap-1 border-2 border-mad-black px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm disabled:opacity-40"

function QueueRow({
  entityId,
  post,
  onUpdate,
}: {
  entityId: string
  post: CampaignQueuePost
  onUpdate: (next: CampaignQueuePost) => void
}) {
  const [busy, setBusy] = useState<"push" | "reschedule" | "cancel" | null>(null)
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState(() => toLocalInput(post.scheduled_time))
  const editable = EDITABLE.has(post.status)
  const label = PLATFORM_LABELS[post.platform] ?? post.platform

  async function onPush() {
    setBusy("push")
    try {
      const result = (await pushScheduledPostNow({
        entityId,
        postId: post.id,
      })) as InventoryActionResult<{ post: CampaignQueuePost; dispatch: ImmediateDispatch }>
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onUpdate(result.data.post)
      const { post: next, dispatch } = result.data
      if (next.status === "published") {
        toast.success(`${label} dispatched.`)
      } else if (dispatch.skippedReason) {
        toast.message(`${label} queued for now: ${dispatch.skippedReason}`)
      } else {
        toast.error(`${label} failed: ${next.last_error ?? dispatch.errors[0]?.error ?? "unknown error"}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onReschedule() {
    setBusy("reschedule")
    try {
      const result = (await rescheduleScheduledPost({
        entityId,
        postId: post.id,
        scheduledTime: new Date(when).toISOString(),
      })) as InventoryActionResult<{ post: CampaignQueuePost }>
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onUpdate(result.data.post)
      setEditing(false)
      toast.success(
        `${label} rescheduled for ${new Date(result.data.post.scheduled_time).toLocaleString()}.`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reschedule failed.")
    } finally {
      setBusy(null)
    }
  }

  async function onCancel() {
    setBusy("cancel")
    try {
      const result = (await cancelScheduledPost({
        entityId,
        postId: post.id,
      })) as InventoryActionResult<{ post: CampaignQueuePost }>
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onUpdate(result.data.post)
      toast.success(`${label} cancelled.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cancel failed.")
    } finally {
      setBusy(null)
    }
  }

  const displayTime =
    post.status === "published" && post.published_at ? post.published_at : post.scheduled_time

  return (
    <li className="space-y-2 border-2 border-mad-black bg-mad-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-black uppercase">
          {label}
        </span>
        <span
          className={cn(
            "border-2 border-mad-black px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-widest uppercase",
            statusTone(post.status)
          )}
        >
          {post.status}
        </span>
        <span
          className="font-typewriter text-[0.6rem] tracking-wider text-neutral-600 uppercase"
          suppressHydrationWarning
        >
          {post.status === "published" ? "Sent " : ""}
          {new Date(displayTime).toLocaleString()}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void onPush()}
            disabled={!editable || busy != null}
            className={cn(actionButton, "bg-mad-black text-mad-white hover:bg-mad-vermillion")}
          >
            {busy === "push" ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
            Push now
          </button>
          <button
            type="button"
            onClick={() => {
              setWhen(toLocalInput(post.scheduled_time))
              setEditing((open) => !open)
            }}
            disabled={!editable || busy != null}
            className={cn(actionButton, "bg-mad-white text-mad-black hover:bg-mad-lime")}
          >
            <CalendarClock className="size-3" />
            Reschedule
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={!editable || busy != null}
                className={cn(actionButton, "bg-mad-white text-mad-black hover:bg-mad-vermillion hover:text-mad-white")}
              >
                {busy === "cancel" ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Cancel
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-none border-2 border-mad-black">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-typewriter uppercase">
                  Cancel this {label} post?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will be removed from the publishing queue and won&apos;t go out.
                  The rest of this campaign stays scheduled.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none">Keep it</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-none bg-mad-vermillion text-mad-white hover:bg-mad-black"
                  onClick={() => void onCancel()}
                >
                  Cancel post
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {post.status === "failed" && post.last_error ? (
        <p className="text-xs leading-relaxed text-mad-vermillion">{post.last_error}</p>
      ) : null}

      {editing ? (
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-mad-black pt-2">
          <input
            type="datetime-local"
            value={when}
            min={toLocalInput(new Date().toISOString())}
            onChange={(event) => setWhen(event.target.value)}
            className="h-8 border-2 border-mad-black bg-mad-white px-2 font-typewriter text-xs"
          />
          <button
            type="button"
            onClick={() => void onReschedule()}
            disabled={!when || busy != null}
            className={cn(actionButton, "bg-mad-black text-mad-white hover:bg-mad-vermillion")}
          >
            {busy === "reschedule" ? <Loader2 className="size-3 animate-spin" /> : null}
            Save time
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase hover:text-mad-black"
          >
            Close
          </button>
        </div>
      ) : null}
    </li>
  )
}

export function CampaignQueuePanel({
  entityId,
  posts,
  onPostsChange,
}: {
  entityId: string
  posts: CampaignQueuePost[]
  onPostsChange: (next: CampaignQueuePost[]) => void
}) {
  if (posts.length === 0) return null

  function update(next: CampaignQueuePost) {
    onPostsChange(
      next.status === "cancelled"
        ? posts.filter((post) => post.id !== next.id)
        : posts.map((post) => (post.id === next.id ? next : post))
    )
  }

  return (
    <section className="space-y-2">
      <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Publishing queue
      </p>
      <ul className="space-y-2">
        {posts.map((post) => (
          <QueueRow key={post.id} entityId={entityId} post={post} onUpdate={update} />
        ))}
      </ul>
    </section>
  )
}
