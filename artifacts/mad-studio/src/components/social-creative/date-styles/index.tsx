"use client"

import { WLS_PROMO_THEME } from "@/lib/social-creative/worn-label-promo-theme"
import type { DateStyle } from "@/types/social-creative"
import { cn } from "@/lib/utils"

type DateBadgeProps = {
  label: string
  style: DateStyle
  compact?: boolean
  /** Light page (A4 print) vs dark promo canvas */
  variant?: "dark" | "light"
  className?: string
}

export function DateBadge({
  label,
  style,
  compact = false,
  variant = "dark",
  className,
}: DateBadgeProps) {
  const text = label.trim()
  if (!text) return null

  const base = cn(
    "inline-flex max-w-full items-center justify-center text-center font-typewriter font-bold uppercase",
    compact ? "text-[0.45rem] tracking-[0.12em]" : "text-[0.55rem] tracking-[0.16em]",
    className
  )

  const gold = WLS_PROMO_THEME.champagneGold
  const onLight = variant === "light"

  switch (style) {
    case "gold_pill":
      return (
        <span
          className={cn(base, "rounded-full px-3 py-1.5")}
          style={{
            background: onLight ? "rgba(197, 168, 128, 0.15)" : WLS_PROMO_THEME.champagneGoldMuted,
            color: onLight ? "#6B5A42" : gold,
            border: `1px solid ${gold}`,
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
            color: onLight ? "#6B5A42" : gold,
            borderColor: gold,
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
              background: gold,
              color: onLight ? "#FFFFFF" : WLS_PROMO_THEME.bg,
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
          style={{ color: onLight ? "#6B5A42" : gold }}
        >
          {text}
        </span>
      )
  }
}
