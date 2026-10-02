"use client"

import type { ReactNode } from "react"

import { AnchoredPhoneShell } from "@/components/studio/anchored-phone-shell"
import { cn } from "@/lib/utils"

type Props = {
  header?: ReactNode
  controls: ReactNode
  navigationDock?: ReactNode
  channelRail?: ReactNode
  preview: ReactNode
  /** Media step and similar flows can omit the phone column entirely. */
  showPreview?: boolean
  lockControlsScroll?: boolean
  className?: string
}

/** Full-width desktop wizard: controls + channel rail + anchored phone. */
export function StudioSplitShell({
  header,
  controls,
  navigationDock,
  channelRail,
  preview,
  showPreview = true,
  lockControlsScroll = false,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full flex-col overflow-hidden px-2 py-1 sm:px-5 xl:px-8 2xl:px-10",
        className
      )}
    >
      {header ? <div className="mb-1 shrink-0 min-w-0">{header}</div> : null}

      {showPreview ? (
        <div className="flex shrink-0 flex-col items-center gap-2 pb-3 lg:hidden">
          {channelRail}
          <div className="w-full max-w-[min(100%,360px)]">
            <AnchoredPhoneShell className="max-w-[360px]">
              {preview}
            </AnchoredPhoneShell>
          </div>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-6 xl:gap-8">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            showPreview
              ? "lg:col-span-8 xl:col-span-9 2xl:col-span-9"
              : "lg:col-span-12"
          )}
        >
          <div
            className={cn(
              "min-h-0 flex-1 overflow-x-hidden pr-0 lg:pr-3",
              lockControlsScroll ? "overflow-hidden" : "overflow-y-auto"
            )}
          >
            {controls}
          </div>
          {navigationDock ? (
            <div className="mt-2 shrink-0 border-t border-mad-black/15 pt-2">
              {navigationDock}
            </div>
          ) : null}
        </div>

        {showPreview ? (
          <div className="hidden min-h-0 lg:col-span-4 lg:flex xl:col-span-3 2xl:col-span-3">
            <div className="sticky top-12 flex max-h-[calc(100dvh-9.5rem)] w-full items-start justify-end gap-2 xl:gap-3">
              {channelRail}
              <AnchoredPhoneShell>{preview}</AnchoredPhoneShell>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
