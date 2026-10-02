"use client"

import { BookOpen } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export function TeamSopGuideBody() {
  return (
    <div className="mt-4 space-y-6 font-typewriter text-[0.65rem] leading-relaxed text-mad-black normal-case">
      <section className="space-y-2 border-2 border-mad-black bg-mad-lime/30 p-3 shadow-keycap-sm">
        <h2 className="text-[0.7rem] font-bold tracking-widest uppercase">
          Track 1: 100% autopilot (Instagram feed &amp; Facebook)
        </h2>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>Select the draft or pull new arrivals in MAD Studio.</li>
          <li>Review copy, vibe, and 4:5 preview in the simulator.</li>
          <li>
            Click{" "}
            <span className="font-bold uppercase">Confirm &amp; publish live</span>
            . Done.
          </li>
        </ol>
      </section>

      <section className="space-y-2 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
        <h2 className="text-[0.7rem] font-bold tracking-widest uppercase">
          Track 2: 45-second draft &amp; drop (Stories &amp; Reels)
        </h2>
        <p className="text-[0.6rem] text-neutral-700">
          Why: Instagram and TikTok block all third-party software from attaching
          native music, polls, or clickable links.
        </p>
        <ol className="list-decimal space-y-1.5 pl-4">
          <li>
            Click{" "}
            <span className="font-bold uppercase">Download ready media</span> in
            MAD Studio.
          </li>
          <li>
            Click{" "}
            <span className="font-bold uppercase">Copy link sticker URL</span>.
          </li>
          <li>
            Open Instagram on your phone → swipe to Story/Reel → pick the
            downloaded media.
          </li>
          <li>
            Tap Sticker tray:
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>To add music: Tap Music and choose a trending sound.</li>
              <li>To add poll: Tap Poll and enter your question.</li>
              <li>
                To add link: Tap Link, paste your clipboard shortlink, and label
                it (&quot;Order Now&quot; / &quot;View Piece&quot;).
              </li>
            </ul>
          </li>
          <li>Tap Share. (Live in ~30 seconds with native reach.)</li>
        </ol>
      </section>
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
            MAD Studio is your creative director — hooks, visuals, and trackable
            links. Native IG/TikTok stickers are always added on your phone.
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
            MAD Studio is your creative director — hooks, visuals, and trackable
            links. Native IG/TikTok stickers are always added on your phone.
          </p>
        </SheetHeader>
        <TeamSopGuideBody />
      </SheetContent>
    </Sheet>
  )
}
