"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  kicker?: string
  title?: string
  description?: string
  children: ReactNode
  className?: string
  bare?: boolean
  /** Stretch card to fill space between step header and footer dock. */
  fill?: boolean
  /** When false with fill, body does not scroll (fit one viewport). */
  scrollBody?: boolean
  compactHeader?: boolean
}

export function StudioStepPanel({
  kicker,
  title,
  description,
  children,
  className,
  bare = false,
  fill = false,
  scrollBody = true,
  compactHeader = false,
}: Props) {
  const hasHeader = !bare && (kicker || title || description)

  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200/80 bg-white shadow-sm",
        fill && "flex min-h-0 flex-1 flex-col",
        bare ? "p-3 md:p-3.5" : "p-3 md:p-4",
        !fill && !bare && "space-y-3",
        className
      )}
    >
      {hasHeader ? (
        <header
          className={cn(
            "border-b border-neutral-100",
            compactHeader ? "space-y-0.5 pb-1.5" : "space-y-1 pb-2.5",
            fill && "shrink-0"
          )}
        >
          {kicker ? (
            <p
              className={cn(
                "font-medium tracking-[0.16em] text-mad-vermillion uppercase",
                compactHeader ? "text-[11px]" : "text-xs"
              )}
            >
              {kicker}
            </p>
          ) : null}
          {title ? (
            <h2
              className={cn(
                "brand-typewriter leading-tight text-mad-black",
                compactHeader ? "text-base md:text-lg" : "text-lg md:text-xl"
              )}
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="max-w-2xl text-xs leading-snug text-neutral-600 md:text-sm">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      <div
        className={cn(
          fill &&
            (scrollBody
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto"
              : "flex min-h-0 flex-1 flex-col justify-start overflow-hidden"),
          fill && hasHeader && (scrollBody ? "pt-2.5" : "pt-2"),
          !fill && bare && "space-y-3",
          fill && bare && "min-h-0 flex-1"
        )}
      >
        {children}
      </div>
    </section>
  )
}
