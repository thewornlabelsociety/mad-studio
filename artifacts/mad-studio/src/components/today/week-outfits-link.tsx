"use client"

import { Link } from "wouter"
import { ArrowRight, Shirt } from "lucide-react"

import { cn } from "@/lib/utils"

/** Today's way into Monday's week-of-outfits carousel. */
export function WeekOutfitsLink({ entityId, className }: { entityId: string; className?: string }) {
  const isWeekend = [0, 6].includes(new Date().getDay())
  return (
    <Link
      href={`/templates/wls-week-outfits?eid=${encodeURIComponent(entityId)}`}
      className={cn(
        "flex items-center gap-3 border-2 border-mad-black bg-white px-3 py-2.5 hover:bg-[#F4EFE6]",
        className
      )}
    >
      <Shirt className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-typewriter text-xs font-bold uppercase tracking-widest">
          A week of outfits
        </span>
        <span className="block text-xs text-mad-black/65">
          {isWeekend
            ? "Get Monday's carousel ready: seven outfits from what's in stock."
            : "Monday's carousel: seven outfits from what's in stock."}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0" aria-hidden />
    </Link>
  )
}
