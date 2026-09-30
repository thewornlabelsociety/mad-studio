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
    <article className="grid grid-cols-[4.75rem_minmax(0,1fr)_9.25rem] items-center gap-3 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm sm:grid-cols-[6.5rem_minmax(0,1fr)_11.5rem] sm:gap-4 sm:p-4">
      <div className="relative aspect-square w-full shrink-0 overflow-hidden border-2 border-mad-black bg-neutral-100">
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
          <div className="flex size-full items-center justify-center font-typewriter text-[0.45rem] font-bold text-neutral-400 uppercase sm:text-[0.5rem]">
            No media
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-1.5 sm:space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {view.isFudi && view.fudiDropKind ? (
            <span className="border-2 border-mad-black bg-[#CCFF00] px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-black uppercase sm:text-[0.55rem]">
              {FUDI_DROP_BADGES[view.fudiDropKind].emoji}{" "}
              {FUDI_DROP_BADGES[view.fudiDropKind].label}
            </span>
          ) : null}
          {view.isWls ? (
            <span className="border-2 border-mad-black bg-mad-lime px-1.5 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase sm:text-[0.55rem]">
              👗 NEW CONSIGNMENT
            </span>
          ) : null}
          <span className="border border-mad-black/60 px-1.5 py-0.5 font-typewriter text-[0.45rem] font-bold tracking-wider uppercase sm:text-[0.5rem]">
            [ {view.channelRecommendation} ]
          </span>
        </div>

        {view.isFudi ? (
          <>
            {view.venueOrBrand ? (
              <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase sm:text-[0.6rem]">
                {view.venueOrBrand}
              </p>
            ) : null}
            <h2 className="line-clamp-2 font-typewriter text-xs font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-sm">
              {view.displayTitle}
            </h2>
            {view.detailLine ? (
              <p className="text-xs text-neutral-600 sm:text-sm">
                {view.detailLine}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="line-clamp-2 font-typewriter text-xs font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-sm">
              {view.item.brand?.trim() || view.displayTitle}
            </h2>
            <p className="line-clamp-2 text-xs text-neutral-700 sm:text-sm">
              {view.displayTitle}
              {view.wlsSize ? ` · Size ${view.wlsSize}` : ""} · {view.wlsPrice}
            </p>
            {view.item.vibe ? (
              <span className="inline-block border border-mad-black px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase sm:text-[0.55rem]">
                Shop-by-Vibe · {view.item.vibe}
              </span>
            ) : null}
          </>
        )}

        <p className="line-clamp-2 text-xs leading-snug text-neutral-800 sm:text-sm">
          <span className="font-typewriter text-[0.5rem] font-bold tracking-widest text-mad-vermillion uppercase sm:text-[0.55rem]">
            Hook ·{" "}
          </span>
          {view.recommendedHook}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 self-center sm:gap-2">
        <Link
          href={studioHref}
          className="inline-flex h-9 items-center justify-center gap-1 border-2 border-mad-black bg-mad-black px-2 font-typewriter text-[0.5rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm transition hover:bg-mad-vermillion sm:h-10 sm:px-3 sm:text-[0.6rem]"
        >
          <Zap className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Craft in Studio</span>
        </Link>
        <button
          type="button"
          onClick={() => onPreview(view)}
          className="inline-flex h-9 items-center justify-center gap-1 border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime sm:h-10 sm:px-3 sm:text-[0.6rem]"
        >
          <Eye className="size-3 shrink-0 sm:size-3.5" />
          <span className="truncate">Quick Preview</span>
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onArchive}
          className={cn(
            "inline-flex h-9 items-center justify-center border-2 border-mad-black bg-mad-white px-2 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase hover:bg-neutral-200 disabled:opacity-50 sm:h-10 sm:px-3 sm:text-[0.6rem]"
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Skip"
          )}
        </button>
      </div>
    </article>
  )
}
