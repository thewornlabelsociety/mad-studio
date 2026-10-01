"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "@/lib/next-compat"
import { Loader2, Sparkles, Zap } from "lucide-react"
import { toast } from "sonner"

import { createFudiFeedCarousel } from "@/lib/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { FudiCarouselTemplateId } from "@/lib/today/fudi-carousel-templates"
import type { TodayQueueView } from "@/lib/today/queue"
import { requestCarouselPromoAngles } from "@/lib/today/carousel-suggest-client"
import {
  carouselItemsFromSelection,
  orderedSourceIds,
} from "@/lib/today/carousel-suggest-sanitize"
import type { CarouselPromoAngle } from "@/lib/today/carousel-suggest-types"
import { WORKBENCH_STEP_COPY, WORKBENCH_STEP_MEDIA } from "@/lib/studio/workbench-steps"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  templateId: FudiCarouselTemplateId
  selectedIds: string[]
  queue: TodayQueueView[]
  onCreated?: (itemId: string) => void
}

export function CarouselStrategyModal({
  open,
  onOpenChange,
  entityId,
  templateId,
  selectedIds,
  queue,
  onCreated,
}: Props) {
  const router = useRouter()
  const [angles, setAngles] = useState<CarouselPromoAngle[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, startTransition] = useTransition()
  const fetchToken = useRef(0)

  const suggestItems = useMemo(
    () => carouselItemsFromSelection(queue, selectedIds),
    [queue, selectedIds]
  )

  const thumbByIndex = useMemo(
    () => suggestItems.map((row) => row.imageUrl),
    [suggestItems]
  )

  useEffect(() => {
    if (!open || selectedIds.length < 2) return
    const token = ++fetchToken.current
    setAngles(null)
    setLoadError(null)
    setLoading(true)

    const items = carouselItemsFromSelection(queue, selectedIds)
    void requestCarouselPromoAngles({
      entityId,
      items,
    })
      .then((result) => {
        if (fetchToken.current !== token) return
        setAngles(result.angles)
      })
      .catch((error: unknown) => {
        if (fetchToken.current !== token) return
        const message =
          error instanceof Error ? error.message : "Could not load promo angles."
        setLoadError(message)
      })
      .finally(() => {
        if (fetchToken.current !== token) return
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when selection or open changes
  }, [open, entityId, selectedIds.join("|")])

  function navigateStudio(itemId: string, step: number) {
    onCreated?.(itemId)
    onOpenChange(false)
    router.push(
      `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(itemId)}&step=${step}`
    )
  }

  function onApply(angle: CarouselPromoAngle) {
    const sourceItemIds = orderedSourceIds(selectedIds, angle.recommended_order)
    startTransition(async () => {
      try {
        const result = await createFudiFeedCarousel({
          entityId,
          sourceItemIds,
          templateId,
          headline: angle.hook,
          caption: angle.caption,
          tags: angle.tags,
          slideSubheads: angle.slide_subheads,
          promoAngle: {
            id: angle.id,
            title: angle.angle_title,
            reasoning: angle.reasoning,
          },
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("Carousel draft ready — customize in Studio.")
        navigateStudio(result.data.itemId, WORKBENCH_STEP_COPY)
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Could not build carousel."
        if (/unknown action/i.test(message)) {
          toast.error(
            "Stale API (8080). Stop the old process, then: pnpm --filter @workspace/api-server run start"
          )
          return
        }
        toast.error(message)
      }
    })
  }

  function onSkipManual() {
    startTransition(async () => {
      try {
        const result = await createFudiFeedCarousel({
          entityId,
          sourceItemIds: selectedIds,
          templateId,
        })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        toast.success("Feed carousel draft ready in Studio.")
        navigateStudio(result.data.itemId, WORKBENCH_STEP_MEDIA)
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Could not build carousel."
        toast.error(message)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden rounded-none border-2 border-mad-black p-0 shadow-keycap-lg">
        <DialogHeader className="shrink-0 border-b-2 border-mad-black px-4 py-3">
          <DialogTitle className="flex items-center gap-2 font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            <Sparkles className="size-4 text-mad-vermillion" />
            Carousel promo angles
          </DialogTitle>
          <p className="font-typewriter text-[0.5rem] leading-relaxed tracking-wider text-neutral-500 normal-case">
            FÜDI Content Intelligence suggests sequencing, hooks, and captions —
            pick one or keep your manual slide order.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading angles">
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="space-y-2 border-2 border-mad-black bg-mad-white p-3"
                >
                  <Skeleton className="h-4 w-2/3 rounded-none" />
                  <div className="flex gap-1">
                    {[0, 1, 2].map((thumb) => (
                      <Skeleton
                        key={thumb}
                        className="aspect-square w-14 rounded-none"
                      />
                    ))}
                  </div>
                  <Skeleton className="h-3 w-full rounded-none" />
                  <Skeleton className="h-8 w-full rounded-none" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="border-2 border-mad-black bg-mad-lime/30 px-3 py-4 text-sm text-mad-black">
              <p className="font-bold">{loadError}</p>
              <p className="mt-2 text-xs text-neutral-700">
                Use manual order below, or retry after the API server is running on
                port 8080.
              </p>
            </div>
          ) : angles ? (
            <ul className="space-y-3">
              {angles.map((angle) => (
                <li
                  key={angle.id}
                  className="border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="inline-block border border-mad-black bg-[#CCFF00] px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase">
                        {angle.angle_title}
                      </span>
                      <p className="mt-1 font-typewriter text-[0.5rem] leading-relaxed text-neutral-600 normal-case">
                        {angle.reasoning}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {angle.recommended_order.map((itemIndex, slidePos) => {
                      const url = thumbByIndex[itemIndex]
                      if (!url) return null
                      return (
                        <div
                          key={`${angle.id}-${slidePos}-${itemIndex}`}
                          className="relative aspect-square w-14 overflow-hidden border border-mad-black"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt=""
                            className="size-full object-cover"
                          />
                          <span className="absolute bottom-0 right-0 bg-mad-black px-1 font-typewriter text-[0.45rem] font-bold text-mad-white">
                            {slidePos + 1}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <p className="mt-2 font-typewriter text-[0.55rem] font-bold tracking-wide text-mad-black">
                    {angle.hook}
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-neutral-700">
                    {angle.caption}
                  </p>

                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onApply(angle)}
                    className={cn(
                      "mt-3 inline-flex h-9 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-50"
                    )}
                  >
                    {pending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Zap className="size-3.5" />
                    )}
                    Apply angle & open Studio
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="shrink-0 border-t-2 border-mad-black px-4 py-3">
          <button
            type="button"
            disabled={pending || loading}
            onClick={onSkipManual}
            className="inline-flex h-10 w-full items-center justify-center border-2 border-mad-black bg-mad-white font-typewriter text-[0.55rem] font-bold tracking-wider uppercase hover:bg-mad-lime disabled:opacity-50"
          >
            Skip AI / manual order
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
