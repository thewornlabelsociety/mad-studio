"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  controls: ReactNode
  preview: ReactNode
  className?: string
}

/** Keeps the phone simulator pinned while step panels scroll. */
export function StudioAnchoredLayout({ controls, preview, className }: Props) {
  return (
    <div
      className={cn(
        "grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start",
        className
      )}
    >
      <div className="min-w-0 space-y-3">{controls}</div>
      <div className="sticky top-[5.5rem] z-10 mx-auto w-full max-w-[400px] justify-self-center lg:justify-self-end">
        {preview}
      </div>
    </div>
  )
}
