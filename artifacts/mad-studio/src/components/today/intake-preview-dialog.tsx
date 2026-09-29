"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TodayQueueView } from "@/lib/today/queue"

type Props = {
  view: TodayQueueView | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntakePreviewDialog({ view, open, onOpenChange }: Props) {
  if (!view) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-none border-2 border-mad-black p-0 shadow-keycap-lg">
        <DialogHeader className="border-b-2 border-mad-black px-4 py-3">
          <DialogTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            Quick preview
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-[4/5] max-h-[70vh] w-full bg-neutral-950">
          {view.mediaUrl ? (
            view.isVideo ? (
              <video
                src={view.mediaUrl}
                className="size-full object-contain"
                controls
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={view.mediaUrl}
                alt=""
                className="size-full object-contain"
              />
            )
          ) : (
            <div className="flex size-full items-center justify-center font-typewriter text-xs text-neutral-400 uppercase">
              No media
            </div>
          )}
        </div>
        <div className="space-y-2 border-t-2 border-mad-black px-4 py-3">
          <p className="font-typewriter text-xs font-bold tracking-wide text-mad-black uppercase">
            {view.specsLine}
          </p>
          <p className="text-sm leading-relaxed text-neutral-800">
            <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Recommended hook ·{" "}
            </span>
            {view.recommendedHook}
          </p>
          <p className="font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
            Target · [{view.channelRecommendation}]
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
