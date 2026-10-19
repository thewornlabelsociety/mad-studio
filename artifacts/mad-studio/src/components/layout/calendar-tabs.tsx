"use client"

import { useMemo } from "react"
import { Link } from "wouter"

import {
  buildCalendarViews,
  isStudioNavActive,
} from "@/lib/navigation/studio-nav"
import { usePathname } from "@/lib/next-compat"
import type { AccessibleEntity } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Switches between the Calendar's views (Plan, Campaigns, Promo). */
export function CalendarTabs({
  activeEntity,
  className,
}: {
  activeEntity: AccessibleEntity
  className?: string
}) {
  const pathname = usePathname()
  const views = useMemo(
    () =>
      buildCalendarViews({
        entityQuery: `?eid=${encodeURIComponent(activeEntity.id)}`,
        activeEntity,
      }),
    [activeEntity]
  )

  return (
    <nav
      aria-label="Calendar views"
      className={cn(
        "flex shrink-0 items-center gap-1 overflow-x-auto border-b border-neutral-200 bg-mad-white px-4 py-2",
        className
      )}
    >
      <span className="mr-2 font-typewriter text-[0.6rem] font-bold tracking-widest text-neutral-500 uppercase">
        Calendar
      </span>
      {views.map((view) => {
        const active = isStudioNavActive(pathname, view.match)
        return (
          <Link
            key={view.id}
            href={view.href}
            title={view.description}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-mad-black text-mad-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-mad-black"
            )}
          >
            {view.label}
          </Link>
        )
      })}
    </nav>
  )
}
