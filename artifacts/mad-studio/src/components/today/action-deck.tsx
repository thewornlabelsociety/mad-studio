"use client"

import { useMemo, useState, useTransition } from "react"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion"
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Loader2,
  Pencil,
  Rocket,
  Smartphone,
} from "lucide-react"
import { toast } from "sonner"

import {
  archiveDailyQueueItem,
  markDailyQueuePublished,
  skipDailyQueueItem,
  updateDailyQueueCopy,
} from "@/lib/actions"
import { IntakePreviewDialog } from "@/components/today/intake-preview-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { resolveItemDestinationUrl } from "@/lib/marketing/story-presets"
import type { TodayDeckCard } from "@/lib/today/daily-queue"
import { resolveTodayLivePostCopy } from "@/lib/today/preview-copy"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry: string
  websiteUrl?: string | null
  initialDeck: TodayDeckCard[]
  liveDateLabel: string
}

const SWIPE_THRESHOLD = 96

export function TodayActionDeck({
  entityId,
  entityName,
  industry,
  websiteUrl = null,
  initialDeck,
  liveDateLabel,
}: Props) {
  const [deck, setDeck] = useState(initialDeck)
  const [index, setIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editHook, setEditHook] = useState("")
  const [editHeadline, setEditHeadline] = useState("")
  const [pending, startTransition] = useTransition()

  const card = deck[index] ?? null
  const liveCopy = useMemo(
    () => (card ? resolveTodayLivePostCopy(card, entityName) : null),
    [card, entityName]
  )

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-180, 180], [-8, 8])
  const archiveHint = useTransform(x, [-120, 0], [1, 0])
  const skipHint = useTransform(x, [0, 120], [0, 1])

  function removeCurrent(id: string) {
    setDeck((prev) => {
      const next = prev.filter((row) => row.item.id !== id)
      setIndex((value) => Math.min(value, Math.max(0, next.length - 1)))
      return next
    })
    x.set(0)
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (!card || pending) return
    if (info.offset.x <= -SWIPE_THRESHOLD) {
      startTransition(async () => {
        const result = await archiveDailyQueueItem({
          entityId,
          queueId: card.queueId,
          itemId: card.item.id,
        })
        if (!result.ok) {
          toast.error(result.error)
          x.set(0)
          return
        }
        removeCurrent(card.item.id)
        toast.message("Archived from today’s deck.")
      })
      return
    }
    if (info.offset.x >= SWIPE_THRESHOLD) {
      startTransition(async () => {
        const result = await skipDailyQueueItem({
          entityId,
          queueId: card.queueId,
        })
        if (!result.ok) {
          toast.error(result.error)
          x.set(0)
          return
        }
        removeCurrent(card.item.id)
        toast.message("Skipped — next drop.")
      })
    }
  }

  function openEdit() {
    if (!card || !liveCopy) return
    setEditHook(liveCopy.captionBody || card.recommendedHook)
    setEditHeadline(liveCopy.headline)
    setEditOpen(true)
  }

  function saveEdit() {
    if (!card) return
    startTransition(async () => {
      try {
      const result = await updateDailyQueueCopy({
        entityId,
        queueId: card.queueId,
        itemId: card.item.id,
        hook: editHook,
        headline: editHeadline,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setDeck((prev) =>
        prev.map((row) =>
          row.item.id === card.item.id
            ? {
                ...row,
                recommendedHook: editHeadline.trim() || row.recommendedHook,
                item: {
                  ...row.item,
                  copy_draft: {
                    ...row.item.copy_draft,
                    headline: editHeadline.trim(),
                    caption: editHook.trim(),
                  },
                },
              }
            : row
        )
      )
      setEditOpen(false)
      toast.success("Copy updated.")
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save copy."
        )
      }
    })
  }

  function oneTapPublish() {
    if (!card || !liveCopy?.fullCaption || !card.mediaUrl) {
      toast.error("Add media before publishing.")
      return
    }
    startTransition(async () => {
      try {
        const destinationUrl = resolveItemDestinationUrl({
          entityId,
          websiteUrl,
          websiteItemId: card.item.website_item_id,
          copyDraft: card.item.copy_draft,
        })
        const response = await fetch("/api/social/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId,
            marketingEntityId: card.item.id,
            platform: card.channel === "tiktok" ? "tiktok" : "instagram",
            placement: card.channel === "ig_story" ? "story" : "feed",
            mediaUrl: card.mediaUrl,
            caption: liveCopy.fullCaption,
            onScreenText: liveCopy.headline,
            spokenHook: liveCopy.captionBody,
            destinationUrl,
            slugSeed: card.slugSeed,
          }),
        })
        const payload = (await response.json()) as { error?: string; message?: string }
        if (!response.ok) {
          throw new Error(payload.error || "Publish failed.")
        }
        await markDailyQueuePublished({
          entityId,
          queueId: card.queueId,
        })
        removeCurrent(card.item.id)
        toast.success(payload.message || "Published — loading next drop.")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Publish failed.")
      }
    })
  }

  if (deck.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 text-center">
        <p className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
          Deck clear
        </p>
        <p className="mt-2 max-w-xs text-sm text-neutral-600">
          No drops awaiting review. Pull new arrivals or open Studio.
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="shrink-0 border-b-2 border-mad-black/10 px-4 py-3">
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          {liveDateLabel}
        </p>
        <h1 className="font-typewriter text-lg font-bold tracking-typewriter-tight uppercase">
          Today · {entityName}
        </h1>
        <p className="text-xs text-neutral-500">
          {index + 1} of {deck.length}
        </p>
        <div
          className="mt-2 flex items-center justify-between gap-2"
          aria-label="Swipe left to archive, swipe right to skip"
        >
          <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 border-2 border-mad-black bg-mad-vermillion/20 px-2 py-1.5 font-typewriter text-[0.45rem] font-bold tracking-wider text-mad-black uppercase shadow-keycap-sm">
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Archive
          </span>
          <ArrowLeftRight
            className="size-5 shrink-0 text-neutral-500"
            aria-hidden
          />
          <span className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 border-2 border-mad-black bg-neutral-100 px-2 py-1.5 font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-800 uppercase shadow-keycap-sm">
            Skip
            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
          </span>
        </div>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-4 py-4">
        <motion.div
          className="pointer-events-none absolute left-6 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-vermillion uppercase"
          style={{ opacity: archiveHint }}
        >
          Archive
        </motion.div>
        <motion.div
          className="pointer-events-none absolute right-6 font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-500 uppercase"
          style={{ opacity: skipHint }}
        >
          Skip
        </motion.div>

        <AnimatePresence mode="wait">
          {card ? (
            <motion.article
              key={card.item.id}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.9}
              style={{ x, rotate }}
              onDragEnd={onDragEnd}
              className="flex w-full max-w-md flex-col overflow-hidden border-2 border-mad-black bg-mad-white shadow-keycap-lg touch-pan-y"
            >
              <div className="relative aspect-[4/5] w-full shrink-0 bg-neutral-100">
                {card.mediaUrl ? (
                  card.isVideo ? (
                    <video
                      src={card.mediaUrl}
                      className="size-full object-cover"
                      muted
                      playsInline
                      autoPlay
                      loop
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.mediaUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  )
                ) : (
                  <div className="flex size-full items-center justify-center font-typewriter text-xs uppercase text-neutral-400">
                    No media
                  </div>
                )}
              </div>

              <div className="space-y-2 px-4 py-4">
                <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-neutral-500 uppercase">
                  {card.channelRecommendation}
                </p>
                <h2 className="font-typewriter text-base font-bold leading-snug tracking-typewriter-tight uppercase">
                  {liveCopy?.headline ?? card.displayTitle}
                </h2>
                <p className="text-sm leading-relaxed text-neutral-700">
                  <span className="font-typewriter text-[0.45rem] font-bold tracking-widest text-mad-vermillion uppercase">
                    Hook ·{" "}
                  </span>
                  {liveCopy?.captionBody || card.recommendedHook}
                </p>
              </div>
            </motion.article>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-mad-black bg-mad-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            disabled={!card || pending}
            onClick={openEdit}
            className="inline-flex flex-1 items-center justify-center gap-1 border-2 border-mad-black bg-mad-white py-3 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
          <button
            type="button"
            disabled={!card || pending}
            onClick={() => setPreviewOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-1 border-2 border-mad-black bg-mad-white py-3 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase"
          >
            <Smartphone className="size-3.5" />
            Preview
          </button>
          <button
            type="button"
            disabled={!card || pending}
            onClick={oneTapPublish}
            className={cn(
              "inline-flex flex-[1.35] items-center justify-center gap-1 border-2 border-mad-black bg-mad-lime py-3 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm",
              pending && "opacity-70"
            )}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-3.5" />
            )}
            1-Tap Approve
          </button>
        </div>
      </div>

      <IntakePreviewDialog
        view={card}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        entityId={entityId}
        entityName={entityName}
        industry={industry}
        websiteUrl={websiteUrl}
        onPublished={(itemId) => removeCurrent(itemId)}
      />

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-none border-t-2 border-mad-black"
        >
          <SheetHeader>
            <SheetTitle className="font-typewriter text-sm font-bold uppercase">
              On-screen copy
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 px-1">
            <label className="block space-y-1">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider uppercase text-neutral-500">
                Headline
              </span>
              <textarea
                value={editHeadline}
                onChange={(event) => setEditHeadline(event.target.value)}
                rows={2}
                className="w-full border-2 border-mad-black px-2 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-typewriter text-[0.5rem] font-bold tracking-wider uppercase text-neutral-500">
                Hook / caption lead
              </span>
              <textarea
                value={editHook}
                onChange={(event) => setEditHook(event.target.value)}
                rows={3}
                className="w-full border-2 border-mad-black px-2 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={saveEdit}
              className="w-full border-2 border-mad-black bg-mad-black py-3 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase"
            >
              Save to card
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
