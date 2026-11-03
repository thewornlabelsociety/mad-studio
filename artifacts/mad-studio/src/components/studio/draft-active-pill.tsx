"use client"

import { X } from "lucide-react"

import { cn } from "@/lib/utils"

type Props = {
  onStartFresh: () => void
  className?: string
}

/** Studio keeps your post as you work; this clears it for good. */
export function DraftActivePill({ onStartFresh, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-mad-black/30 bg-neutral-50 px-3 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase",
        className
      )}
      title="Your post saves as you go, even if you click away."
    >
      Draft saved
      <button
        type="button"
        onClick={onStartFresh}
        className="inline-flex items-center gap-1 text-mad-vermillion hover:underline"
        aria-label="Clear draft"
      >
        <X className="size-3" aria-hidden />
        Clear draft
      </button>
    </span>
  )
}
