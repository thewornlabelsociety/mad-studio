"use client"

import { Link } from "wouter"
import { ArrowRight, Search, Shirt, Tag, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TOOLS: Array<{ path: string; icon: LucideIcon; title: string; detail: string }> = [
  {
    path: "/templates/wls-week-outfits",
    icon: Shirt,
    title: "A week of outfits",
    detail: "Monday carousel from what's in stock",
  },
  {
    path: "/templates/wls-sale-rack",
    icon: Tag,
    title: "Sale rack",
    detail: "Thursday carousel and Stories from markdowns",
  },
  {
    path: "/templates/wls-wants",
    icon: Search,
    title: "We're searching for",
    detail: "Ask for the stock you want consigned",
  },
]

/** Today's ways into the weekly posts. */
export function TodayToolLinks({ entityId, className }: { entityId: string; className?: string }) {
  return (
    <nav aria-label="Weekly posts" className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {TOOLS.map(({ path, icon: Icon, title, detail }) => (
        <Link
          key={path}
          href={`${path}?eid=${encodeURIComponent(entityId)}`}
          className="flex items-center gap-3 border-2 border-mad-black bg-white px-3 py-2.5 hover:bg-[#F4EFE6]"
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-typewriter text-xs font-bold uppercase tracking-widest">{title}</span>
            <span className="block truncate text-xs text-mad-black/65">{detail}</span>
          </span>
          <ArrowRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
