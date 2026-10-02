"use client"

import type { ReactNode } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { StudioWizardStepSop } from "@/lib/studio/studio-wizard-sop"
import { cn } from "@/lib/utils"

const TOOLTIP_PANEL =
  "max-w-xs rounded-none border-2 border-mad-black bg-mad-white px-3 py-2 text-mad-black shadow-keycap-sm"

export function StudioWizardSopChecklist({
  sop,
  title = "SOP",
  className,
}: {
  sop: StudioWizardStepSop
  title?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5 font-typewriter text-[0.6rem] leading-relaxed normal-case", className)}>
      <p className="text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
        {title}
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-neutral-800">
        {sop.checklist.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
    </div>
  )
}

export function StudioWizardSopHover({
  sop,
  children,
  side = "bottom",
}: {
  sop: StudioWizardStepSop
  children: ReactNode
  side?: "top" | "bottom" | "left" | "right"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={TOOLTIP_PANEL}>
        <StudioWizardSopChecklist sop={sop} />
      </TooltipContent>
    </Tooltip>
  )
}
