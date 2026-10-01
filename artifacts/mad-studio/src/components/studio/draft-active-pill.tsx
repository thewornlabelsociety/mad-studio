"use client"

import { cn } from "@/lib/utils"

type Props = {
  onStartFresh: () => void
  className?: string
}

export function DraftActivePill({ onStartFresh, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border border-mad-black/30 bg-neutral-50 px-3 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase",
        className
      )}
    >
      Draft active
      <button
        type="button"
        onClick={onStartFresh}
        className="text-mad-vermillion hover:underline"
        aria-label="Start fresh"
      >
        ✕ Start fresh
      </button>
    </span>
  )
}
