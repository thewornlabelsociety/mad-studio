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
        bare ? "p-4 md:p-5" : "p-5 md:p-6",
        !fill && !bare && "space-y-5",
        className
      )}
    >
      {hasHeader ? (
        <header
          className={cn(
            "border-b border-neutral-100",
            compactHeader ? "space-y-1 pb-2" : "space-y-2 pb-4",
            fill && "shrink-0"
          )}
        >
          {kicker ? (
            <p
              className={cn(
                "font-medium tracking-[0.2em] text-mad-vermillion uppercase",
                compactHeader ? "text-xs" : "text-[12px]"
              )}
            >
              {kicker}
            </p>
          ) : null}
          {title ? (
            <h2
              className={cn(
                "brand-typewriter leading-tight text-mad-black",
                compactHeader ? "text-lg md:text-xl" : "text-xl md:text-2xl"
              )}
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="max-w-xl text-sm leading-relaxed text-neutral-600">
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
          fill && hasHeader && (scrollBody ? "pt-4" : "pt-3"),
          !fill && bare && "space-y-4",
          fill && bare && "min-h-0 flex-1"
        )}
      >
        {children}
      </div>
    </section>
  )
}
