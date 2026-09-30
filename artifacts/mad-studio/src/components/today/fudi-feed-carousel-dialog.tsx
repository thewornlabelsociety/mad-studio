"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@/lib/next-compat"
import { Images, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createFudiFeedCarousel } from "@/lib/actions"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FUDI_CAROUSEL_TEMPLATES,
  type FudiCarouselTemplateId,
} from "@/lib/today/fudi-carousel-templates"
import type { TodayQueueView } from "@/lib/today/queue"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  queue: TodayQueueView[]
  onCreated?: (itemId: string) => void
}

export function FudiFeedCarouselDialog({
  open,
  onOpenChange,
  entityId,
  queue,
  onCreated,
}: Props) {
  const router = useRouter()
  const [templateId, setTemplateId] =
    useState<FudiCarouselTemplateId>("feed_today")
  const [selected, setSelected] = useState<string[]>([])
  const [pending, startTransition] = useTransition()

  const selectable = useMemo(
    () => queue.filter((row) => row.mediaUrl && !row.isVideo),
    [queue]
  )

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((row) => row !== id)
      }
      if (current.length >= 10) {
        toast.message("Carousel supports up to 10 images.")
        return current
      }
      return [...current, id]
    })
  }

  function onBuild() {
    if (selected.length < 2) {
      toast.message("Pick at least two feed images for a carousel.")
      return
    }
    startTransition(async () => {
      const result = await createFudiFeedCarousel({
        entityId,
        sourceItemIds: selected,
        templateId,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Feed carousel draft ready in Studio.")
      onCreated?.(result.data.itemId)
      onOpenChange(false)
      router.push(
        `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(result.data.itemId)}`
      )
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden rounded-none border-2 border-mad-black p-0 shadow-keycap-lg">
        <DialogHeader className="shrink-0 border-b-2 border-mad-black px-4 py-3">
          <DialogTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            Build feed carousel
          </DialogTitle>
          <p className="font-typewriter text-[0.5rem] leading-relaxed tracking-wider text-neutral-500 normal-case">
            Multi-image IG / Facebook carousel for FÜDI platform promo — pick
            slides from today&apos;s intake, then craft in Studio.
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <div className="space-y-1.5">
            <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
              Promo angle
            </p>
            <div className="flex flex-wrap gap-1">
              {FUDI_CAROUSEL_TEMPLATES.map((template) => {
                const active = templateId === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setTemplateId(template.id)}
                    className={cn(
                      "border-2 border-mad-black px-2 py-1 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase transition",
                      active
                        ? "bg-[#CCFF00] text-mad-black"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    {template.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
              Slides ({selected.length}/10)
            </p>
            {selectable.length === 0 ? (
              <p className="text-xs text-neutral-600">
                No still-image intake rows — pull the feed first.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selectable.map((row) => {
                  const active = selected.includes(row.item.id)
                  const order = selected.indexOf(row.item.id)
                  return (
                    <li key={row.item.id}>
                      <button
                        type="button"
                        onClick={() => toggle(row.item.id)}
                        className={cn(
                          "relative aspect-square w-full overflow-hidden border-2 border-mad-black",
                          active ? "ring-2 ring-mad-vermillion ring-offset-1" : ""
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.mediaUrl!}
                          alt=""
                          className="size-full object-cover"
                        />
                        {active ? (
                          <span className="absolute right-0 top-0 bg-mad-black px-1.5 py-0.5 font-typewriter text-[0.55rem] font-bold text-mad-white">
                            {order + 1}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-mad-black px-4 py-3">
          <button
            type="button"
            disabled={pending || selected.length < 2}
            onClick={onBuild}
            className="inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black bg-mad-black font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Images className="size-4" />
            )}
            Create carousel draft
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
