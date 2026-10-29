"use client"

import { useLocation } from "wouter"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/** Back to the screen you came from; `fallback` when the page was opened directly. */
export function BackButton({ fallback, className }: { fallback: string; className?: string }) {
  const [, navigate] = useLocation()
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back()
        else navigate(fallback)
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 self-start py-1 text-sm text-mad-black/70 hover:text-mad-black",
        className
      )}
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back
    </button>
  )
}
