"use client"

import { BookOpen } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  STUDIO_SOP_DRAWER_INTRO,
  TEAM_POSTING_TRACK_SOPS,
} from "@/lib/studio/studio-wizard-sop"
import { cn } from "@/lib/utils"

export function TeamSopGuideBody() {
  return (
    <div className="mt-4 space-y-6 font-typewriter text-[0.65rem] leading-relaxed text-mad-black normal-case">
      {TEAM_POSTING_TRACK_SOPS.map((track, index) => (
        <section
          key={track.id}
          className={cn(
            "space-y-2 border-2 border-mad-black p-3 shadow-keycap-sm",
            index === 0 ? "bg-mad-lime/30" : "bg-mad-white"
          )}
        >
          <h2 className="text-[0.7rem] font-bold tracking-widest uppercase">
            {track.title}
          </h2>
          {track.intro ? (
            <p className="text-[0.6rem] text-neutral-700">{track.intro}</p>
          ) : null}
          <ol className="list-decimal space-y-1.5 pl-4">
            {track.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {track.stickerBullets?.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-[0.6rem]">
              {track.stickerBullets.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  )
}

type SheetProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function TeamSopGuideSheet({ open, onOpenChange }: SheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto border-l-2 border-mad-black bg-mad-white sm:max-w-lg"
      >
        <SheetHeader className="border-b-2 border-mad-black pb-3 text-left">
          <SheetTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            Team SOP &amp; posting guide
          </SheetTitle>
          <p className="font-typewriter text-[0.55rem] leading-relaxed tracking-wide text-neutral-600 normal-case">
            {STUDIO_SOP_DRAWER_INTRO}
          </p>
        </SheetHeader>
        <TeamSopGuideBody />
      </SheetContent>
    </Sheet>
  )
}

type Props = {
  className?: string
  compact?: boolean
}

export function TeamSopGuideDrawer({ className, compact = false }: Props) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-white px-2.5 py-1.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm transition-colors hover:bg-mad-lime",
            className
          )}
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden />
          {compact ? "SOP" : "📖 Team SOP & Posting Guide"}
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto border-l-2 border-mad-black bg-mad-white sm:max-w-lg"
      >
        <SheetHeader className="border-b-2 border-mad-black pb-3 text-left">
          <SheetTitle className="font-typewriter text-sm font-bold tracking-typewriter-tight uppercase">
            Team SOP &amp; posting guide
          </SheetTitle>
          <p className="font-typewriter text-[0.55rem] leading-relaxed tracking-wide text-neutral-600 normal-case">
            {STUDIO_SOP_DRAWER_INTRO}
          </p>
        </SheetHeader>
        <TeamSopGuideBody />
      </SheetContent>
    </Sheet>
  )
}
