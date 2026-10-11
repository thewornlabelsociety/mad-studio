"use client"

import { WLS_PROMO_THEME } from "@/lib/social-creative/worn-label-promo-theme"
import type { DateStyle } from "@/types/social-creative"
import { cn } from "@/lib/utils"

type DateBadgeProps = {
  label: string
  style: DateStyle
  compact?: boolean
  className?: string
}

export function DateBadge({ label, style, compact = false, className }: DateBadgeProps) {
  const text = label.trim()
  if (!text) return null

  const base = cn(
    "inline-flex max-w-full items-center justify-center text-center font-typewriter font-bold uppercase",
    compact ? "text-[0.45rem] tracking-[0.12em]" : "text-[0.55rem] tracking-[0.16em]",
    className
  )

  switch (style) {
    case "gold_pill":
      return (
        <span
          className={cn(base, "rounded-full px-3 py-1.5")}
          style={{
            background: WLS_PROMO_THEME.champagneGoldMuted,
            color: WLS_PROMO_THEME.champagneGold,
            border: `1px solid ${WLS_PROMO_THEME.champagneGold}`,
          }}
        >
          {text}
        </span>
      )
    case "stamp":
      return (
        <span
          className={cn(base, "border-2 border-dashed px-3 py-1.5")}
          style={{
            color: WLS_PROMO_THEME.champagneGold,
            borderColor: WLS_PROMO_THEME.champagneGold,
            transform: "rotate(-2deg)",
          }}
        >
          {text}
        </span>
      )
    case "ribbon":
      return (
        <span className={cn("relative inline-flex max-w-full", className)}>
          <span
            className={cn(base, "relative z-10 px-4 py-1.5")}
            style={{
              background: WLS_PROMO_THEME.champagneGold,
              color: WLS_PROMO_THEME.bg,
            }}
          >
            {text}
          </span>
          <span
            aria-hidden
            className="absolute -bottom-1 left-2 h-2 w-[calc(100%-1rem)]"
            style={{
              background: "rgba(197, 168, 128, 0.45)",
              clipPath: "polygon(0 0, 100% 0, 96% 100%, 4% 100%)",
            }}
          />
        </span>
      )
    case "minimal":
    default:
      return (
        <span
          className={cn(base, "tracking-[0.2em]")}
          style={{ color: WLS_PROMO_THEME.champagneGold }}
        >
          {text}
        </span>
      )
  }
}
