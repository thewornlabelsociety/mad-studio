"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DetailDrawerProps = {
  open: boolean
  onClose: () => void
  title?: ReactNode
  headerSlot?: ReactNode
  children: ReactNode
  className?: string
  widthClassName?: string
}

/** Right inspector panel (master–detail), like social analytics tools. */
export function StudioDetailDrawer({
  open,
  onClose,
  title,
  headerSlot,
  children,
  className,
  widthClassName = "w-full sm:w-[min(100%,26rem)] lg:w-[28rem]",
}: DetailDrawerProps) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/25 lg:hidden"
        aria-label="Close panel"
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex flex-col border-l border-neutral-200 bg-mad-white shadow-2xl",
          "lg:sticky lg:top-0 lg:z-0 lg:h-full lg:min-h-0 lg:shadow-none",
          widthClassName,
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0 flex-1">
            {headerSlot ?? (title ? (
              <h2 className="truncate text-sm font-semibold text-mad-black">
                {title}
              </h2>
            ) : null)}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-md"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  )
}

type MasterDetailProps = {
  main: ReactNode
  detail: ReactNode
  detailOpen: boolean
  className?: string
  mainClassName?: string
}

export function StudioMasterDetailLayout({
  main,
  detail,
  detailOpen,
  className,
  mainClassName,
}: MasterDetailProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col lg:flex-row",
        detailOpen && "lg:overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto",
          mainClassName
        )}
      >
        {main}
      </div>
      {detail}
    </div>
  )
}
