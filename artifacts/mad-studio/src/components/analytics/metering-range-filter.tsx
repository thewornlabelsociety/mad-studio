"use client"

import { Link } from "wouter"
import { usePathname, useSearchParams } from "@/lib/next-compat"

import { cn } from "@/lib/utils"
import type { MeteringRange } from "@/lib/analytics/metering"

const RANGES: Array<{ value: MeteringRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "all", label: "All Time" },
]

type Props = {
  entityId: string
  activeRange: MeteringRange
}

export function MeteringRangeFilter({ entityId, activeRange }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <div className="flex flex-wrap gap-1">
      {RANGES.map((range) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("eid", entityId)
        params.set("range", range.value)
        const href = `${pathname}?${params.toString()}`
        const active = activeRange === range.value

        return (
          <Link
            key={range.value}
            href={href}
            className={cn(
              "border-2 px-2.5 py-1.5 font-typewriter text-[0.65rem] tracking-typewriter-tight uppercase transition-colors",
              active
                ? "border-mad-black bg-mad-black text-mad-white shadow-keycap-sm"
                : "border-mad-black bg-mad-white text-mad-black hover:bg-mad-lime"
            )}
          >
            {range.label}
          </Link>
        )
      })}
    </div>
  )
}
