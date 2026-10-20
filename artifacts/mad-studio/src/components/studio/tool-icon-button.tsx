"use client"

import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = Omit<ComponentPropsWithoutRef<"button">, "children"> & {
  /** Short name, shown on hover and read by screen readers. */
  label: string
  /** Optional second line in the hover card. */
  hint?: string
  icon: ReactNode
  active?: boolean
}

/**
 * Square icon-only tool button with a hover label (Lucide icons only).
 * Wrap a row of these in a TooltipProvider.
 */
export const ToolIconButton = forwardRef<HTMLButtonElement, Props>(
  function ToolIconButton(
    { label, hint, icon, active = false, className, ...props },
    ref
  ) {
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label={label}
            aria-pressed={active || undefined}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center border-2 border-mad-black transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "bg-mad-black text-mad-white shadow-keycap-sm"
                : "bg-mad-white text-mad-black hover:bg-mad-lime",
              className
            )}
            {...props}
          >
            {icon}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-[14rem] border-2 border-mad-black bg-mad-black text-mad-white"
        >
          <p className="font-typewriter text-[0.72rem] font-bold tracking-wider uppercase">
            {label}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-neutral-300">{hint}</p> : null}
        </TooltipContent>
      </Tooltip>
    )
  }
)
