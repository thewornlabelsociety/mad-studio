"use client"

import { Link } from "wouter"
import { ArrowRight, CalendarRange, Clock, Columns2, Megaphone, Search, Shirt, Sparkles, Tag, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const TOOLS: Array<{ path: string; icon: LucideIcon; title: string; detail: string }> = [
  {
    path: "/week",
    icon: CalendarRange,
    title: "Plan the week",
    detail: "Your grid and what's still to make",
  },
  {
    path: "/templates/wls-week-outfits",
    icon: Shirt,
    title: "A week of outfits",
    detail: "Monday carousel from what's in stock",
  },
  {
    path: "/templates/wls-inspo",
    icon: Columns2,
    title: "Inspo vs WLS",
    detail: "Wednesday: the look, and yours from the racks",
  },
  {
    path: "/templates/wls-edit",
    icon: Sparkles,
    title: "Themed edit",
    detail: "Race day, wedding guest: title, flatlay and pieces",
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
  {
    path: "/templates/wls-announcement",
    icon: Megaphone,
    title: "Announcement",
    detail: "Sales, hours and events",
  },
  {
    path: "/templates/wls-opening-hours",
    icon: Clock,
    title: "Opening hours",
    detail: "Today or the week, from the website",
  },
]

/** Ways into the weekly posts; `exclude` drops the page you're already on. */
export function TodayToolLinks({
  entityId,
  exclude = [],
  stacked = false,
  className,
}: {
  entityId: string
  exclude?: string[]
  /** One per row, for narrow panels. */
  stacked?: boolean
  className?: string
}) {
  const tools = TOOLS.filter((tool) => !exclude.includes(tool.path))
  return (
    <nav aria-label="Weekly posts" className={cn("grid gap-2", !stacked && "sm:grid-cols-2 xl:grid-cols-4", className)}>
      {tools.map(({ path, icon: Icon, title, detail }) => (
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
