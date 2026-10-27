"use client"

import type { ReactNode } from "react"

import { StudioLivePreviewDrawer } from "@/components/studio/studio-live-preview-drawer"
import { cn } from "@/lib/utils"

export type StudioPreviewDrawerState = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Props = {
  header?: ReactNode
  /** Full-width platform / preview channel bar (below step header). */
  platformBar?: ReactNode
  controls: ReactNode
  /** Optional grid override for main + preview columns (e.g. wider phone on Canvas). */
  previewGridClassName?: string
  navigationDock?: ReactNode
  /** Work-column footer (e.g. WLS product strip), rendered above the nav dock inside the scroll pane. */
  footer?: ReactNode
  channelRail?: ReactNode
  preview: ReactNode
  /** Small actions shown beside the "Live preview" label (e.g. save layout). */
  previewActions?: ReactNode
  showInlinePreview?: boolean
  /** @deprecated Use showInlinePreview */
  showPreview?: boolean
  previewDrawer?: StudioPreviewDrawerState
  lockControlsScroll?: boolean
  className?: string
}

/** Full-width two-column create: work pane + preview pane edge-to-edge. */
export function StudioSplitShell({
  header,
  platformBar,
  controls,
  navigationDock,
  footer,
  channelRail,
  previewGridClassName,
  preview,
  previewActions = null,
  showInlinePreview,
  showPreview = false,
  previewDrawer,
  className,
}: Props) {
  const inlineAllowed = showInlinePreview ?? showPreview
  const drawerOpen = previewDrawer?.open ?? false
  const previewInDrawer = drawerOpen
  /** Desktop: live column stays visible while editing. Drawer is mobile-only. */
  const previewInline = inlineAllowed

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden bg-neutral-100",
        className
      )}
    >
      {header ? <div className="w-full shrink-0">{header}</div> : null}
      {platformBar ? <div className="w-full shrink-0">{platformBar}</div> : null}

      <div
        className={cn(
          "grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden",
          previewInline &&
            (previewGridClassName ??
              "lg:grid-cols-[minmax(0,1fr)_minmax(200px,min(17rem,24vw))] xl:grid-cols-[minmax(0,1fr)_minmax(210px,min(18rem,22vw))]")
        )}
      >
        <div className="flex min-h-0 min-w-0 h-full w-full flex-col overflow-hidden bg-[#f4f3f0] lg:border-r lg:border-neutral-200/90">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 py-1 sm:px-2">
            {controls}
            {footer ? (
              <div className="mt-2 w-full shrink-0 border-t border-neutral-200/90 bg-[#f4f3f0] pt-1.5">
                {footer}
              </div>
            ) : null}
          </div>
          {navigationDock ? (
            <div className="relative z-20 w-full shrink-0 border-t border-neutral-200/90 bg-white px-1.5 py-1.5 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.12)] sm:px-2">
              <div className="w-full min-w-0">{navigationDock}</div>
            </div>
          ) : null}
        </div>

        {previewInline ? (
          <div className="hidden h-full min-h-0 min-w-0 w-full flex-col overflow-hidden border-l border-neutral-200/80 bg-neutral-100 lg:flex">
            <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col items-stretch gap-1 overflow-hidden px-1 py-1">
              <div className="flex w-full shrink-0 items-center justify-between gap-1">
                <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                  Preview
                </p>
                {previewActions}
              </div>
              <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden">
                {preview}
              </div>
              {channelRail ? (
                <div className="flex w-full shrink-0 justify-center pb-0.5">
                  {channelRail}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {previewDrawer && drawerOpen ? (
        <StudioLivePreviewDrawer
          open
          onClose={() => previewDrawer.onOpenChange(false)}
          channelRail={channelRail}
        >
          {previewInDrawer ? preview : null}
        </StudioLivePreviewDrawer>
      ) : null}
    </div>
  )
}
