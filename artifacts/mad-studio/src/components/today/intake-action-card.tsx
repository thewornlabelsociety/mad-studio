"use client"

import { useTransition } from "react"
import { Link } from "wouter"
import { Eye, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

import { approveMarketingEntity } from "@/lib/actions"
import { FUDI_DROP_BADGES } from "@/lib/today/agenda"
import type { TodayQueueView } from "@/lib/today/queue"
import { cn } from "@/lib/utils"

type Props = {
  view: TodayQueueView
  entityId: string
  onSkip: (itemId: string) => void
  onPreview: (view: TodayQueueView) => void
}

export function IntakeActionCard({
  view,
  entityId,
  onSkip,
  onPreview,
}: Props) {
  const [pending, startTransition] = useTransition()
  const studioHref = `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(view.item.id)}`

  function onArchive() {
    startTransition(async () => {
      const result = await approveMarketingEntity({
        entityId,
        itemId: view.item.id,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onSkip(view.item.id)
      toast.message("Removed from today’s intake queue.")
    })
  }

  return (
    <article className="grid gap-4 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm lg:grid-cols-[6.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-5 lg:p-4">
      <div className="relative mx-auto aspect-square w-24 overflow-hidden border-2 border-mad-black bg-neutral-100 lg:mx-0 lg:w-full">
        {view.mediaUrl ? (
          view.isVideo ? (
            <video
              src={view.mediaUrl}
              className="size-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={view.mediaUrl} alt="" className="size-full object-cover" />
          )
        ) : (
          <div className="flex size-full items-center justify-center font-typewriter text-[0.5rem] font-bold text-neutral-400 uppercase">
            No media
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {view.isFudi && view.fudiDropKind ? (
            <span className="border-2 border-mad-black bg-[#CCFF00] px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase">
              {FUDI_DROP_BADGES[view.fudiDropKind].emoji}{" "}
              {FUDI_DROP_BADGES[view.fudiDropKind].label}
            </span>
          ) : null}
          {view.isWls ? (
            <span className="border-2 border-mad-black bg-mad-lime px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase">
              👗 NEW CONSIGNMENT
            </span>
          ) : null}
          <span className="border border-mad-black/60 px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase">
            [ {view.channelRecommendation} ]
          </span>
        </div>

        {view.isFudi ? (
          <>
            {view.venueOrBrand ? (
              <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-neutral-500 uppercase">
                {view.venueOrBrand}
              </p>
            ) : null}
            <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              {view.item.title}
            </h2>
            <p className="text-sm text-neutral-700">{view.detailLine}</p>
          </>
        ) : (
          <>
            <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              {view.item.brand?.trim() || view.item.title}
            </h2>
            <p className="text-sm text-neutral-700">
              {view.item.title}
              {view.wlsSize ? ` · Size ${view.wlsSize}` : ""} · {view.wlsPrice}
            </p>
            {view.item.vibe ? (
              <span className="inline-block border border-mad-black px-2 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase">
                Shop-by-Vibe · {view.item.vibe}
              </span>
            ) : null}
          </>
        )}

        <p className="text-sm leading-snug text-neutral-800">
          <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Hook ·{" "}
          </span>
          {view.recommendedHook}
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:w-56">
        <Link
          href={studioHref}
          className="inline-flex h-10 items-center justify-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm transition hover:bg-mad-vermillion"
        >
          <Zap className="size-3.5" />
          [ ⚡ Craft in Studio → ]
        </Link>
        <button
          type="button"
          onClick={() => onPreview(view)}
          className="inline-flex h-10 items-center justify-center gap-1.5 border-2 border-mad-black bg-mad-white px-3 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime"
        >
          <Eye className="size-3.5" />
          [ 👁️ Quick Preview ]
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onArchive}
          className={cn(
            "inline-flex h-10 items-center justify-center border-2 border-mad-black bg-mad-white px-3 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase hover:bg-neutral-200 disabled:opacity-50"
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "[ Skip / Archive ]"
          )}
        </button>
      </div>
    </article>
  )
}
