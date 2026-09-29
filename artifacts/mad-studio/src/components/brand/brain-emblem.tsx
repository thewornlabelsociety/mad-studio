"use client"

import { Link } from "wouter"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** Replace `public/mad-brain.png` with your transparent PNG (no matte). */
const MAD_BRAIN_SRC = "/mad-brain.png?v=transparent"

type BrainEmblemProps = {
  size?: number
  className?: string
}

export function BrainEmblem({ size = 48, className }: BrainEmblemProps) {
  return (
    <img
      src={MAD_BRAIN_SRC}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={cn(
        "block h-auto w-auto max-w-none shrink-0 select-none object-contain",
        className
      )}
      style={{ height: size, width: "auto" }}
    />
  )
}

type BrainEmblemLinkProps = BrainEmblemProps & {
  entityId: string
  tooltip?: string
}

export function BrainEmblemLink({
  entityId,
  size = 48,
  className,
  tooltip = "Open Brand Brain",
}: BrainEmblemLinkProps) {
  const href = `/brain?eid=${encodeURIComponent(entityId)}`

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            className={cn(
              "inline-flex items-center justify-center overflow-visible leading-none transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mad-black focus-visible:ring-offset-2",
              className
            )}
            aria-label={tooltip}
          >
            <BrainEmblem size={size} />
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={8}
          className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] tracking-wider text-mad-white uppercase"
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
