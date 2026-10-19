"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onClose: () => void
  channelRail?: ReactNode
  children: ReactNode
  className?: string
}

/** Fixed right drawer for the studio phone preview (over workspace, all steps). */
export function StudioLivePreviewDrawer({
  open,
  onClose,
  channelRail,
  children,
  className,
}: Props) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/30 lg:hidden"
        aria-label="Close live preview"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-[min(100%,22rem)] flex-col border-l border-neutral-200 bg-mad-white shadow-2xl sm:w-[26rem] lg:hidden",
          className
        )}
        role="dialog"
        aria-label="Live preview"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Live preview
            </p>
            <p className="text-xs text-neutral-600">
              Updates as you edit media, canvas, and copy.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 py-4">
          <div className="flex w-full shrink-0 justify-center">{children}</div>
          {channelRail ? (
            <div className="flex w-full shrink-0 justify-center">{channelRail}</div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
