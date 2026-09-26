"use client"

import Link from "next/link"
import { Zap } from "lucide-react"

import type { TodayQueueView } from "@/lib/today/queue"
import { cn } from "@/lib/utils"

type Props = {
  view: TodayQueueView
  entityId: string
  brandName: string
  websiteUrl?: string | null
}

export function QueueCard({ view, entityId, brandName }: Props) {
  const studioHref = `/studio?eid=${encodeURIComponent(entityId)}&itemId=${encodeURIComponent(view.item.id)}`

  return (
    <article className="grid gap-4 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:p-4">
      <div className="relative mx-auto aspect-square w-28 overflow-hidden border-2 border-mad-black bg-neutral-100 sm:mx-0 sm:w-full">
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
            <img
              src={view.mediaUrl}
              alt=""
              className="size-full object-cover"
            />
          )
        ) : (
          <div className="flex size-full items-center justify-center font-typewriter text-[0.55rem] font-bold tracking-wider text-neutral-400 uppercase">
            No media
          </div>
        )}
        {view.isVideo ? (
          <span className="absolute bottom-1.5 left-1.5 border border-mad-black bg-mad-black px-1.5 py-0.5 font-typewriter text-[0.55rem] font-bold text-mad-white">
            ▶ Reel
          </span>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            {view.specsLine}
          </h2>
          <span
            className={cn(
              "border border-mad-black px-1.5 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase",
              view.channel === "tiktok"
                ? "bg-mad-vermillion text-mad-white"
                : "bg-mad-lime text-mad-black"
            )}
          >
            {view.channel === "tiktok" ? "🎵 TikTok" : "📸 IG Story"}
          </span>
          {view.fudiTrackLabel ? (
            <span className="border border-mad-black bg-mad-white px-1.5 py-0.5 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase">
              {view.fudiTrackLabel}
            </span>
          ) : null}
        </div>

        <p className="text-sm leading-snug text-neutral-800">
          <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Hook ·{" "}
          </span>
          {view.recommendedHook}
        </p>
        <p className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
          {brandName} · {view.item.status}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:w-52">
        <Link
          href={studioHref}
          className="inline-flex h-11 items-center justify-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 font-typewriter text-[0.65rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm transition hover:bg-mad-vermillion"
        >
          <Zap className="size-3.5" />
          Add to Studio →
        </Link>
      </div>
    </article>
  )
}
