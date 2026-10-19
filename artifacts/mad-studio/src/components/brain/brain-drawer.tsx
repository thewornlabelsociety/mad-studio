"use client"

import { useEffect, useState } from "react"
import { Link } from "wouter"
import { ArrowUpRight, Brain, X } from "lucide-react"

import { BrainChat } from "@/app/brain/components/brain-chat"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityId: string
  entityName: string
  industry: string
}

/**
 * Brand Brain from anywhere: a non-modal panel on the right, so the page
 * underneath stays usable. It stays mounted after the first open, which keeps
 * the conversation when it's closed and reopened.
 */
export function BrainDrawer({
  open,
  onOpenChange,
  entityId,
  entityName,
  industry,
}: Props) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  if (!mounted) return null

  return (
    <aside
      aria-label={`Brand Brain for ${entityName}`}
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100vw)] flex-col border-l-2 border-mad-black bg-mad-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-200",
        open ? "translate-x-0" : "pointer-events-none translate-x-full"
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b-2 border-mad-black px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center border-2 border-mad-black bg-mad-lime">
            <Brain className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Brand Brain
            </p>
            <p className="truncate text-sm font-semibold text-mad-black">
              {entityName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/brain?eid=${encodeURIComponent(entityId)}`}
            className="inline-flex h-8 items-center gap-1 border-2 border-mad-black px-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
            title="Open the full Brand Brain page"
          >
            Full Brain
            <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex size-8 items-center justify-center border-2 border-mad-black hover:bg-mad-lime"
            aria-label="Close Brand Brain"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <BrainChat
          key={entityId}
          entityId={entityId}
          entityName={entityName}
          industry={industry}
          embedded
        />
      </div>
    </aside>
  )
}
