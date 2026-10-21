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
  controls: ReactNode
  navigationDock?: ReactNode
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
  controls,
  navigationDock,
  channelRail,
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

      <div
        className={cn(
          "grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden",
          // Slim phone column flush right — editing tools get the rest.
          previewInline &&
            "lg:grid-cols-[minmax(0,1fr)_minmax(200px,min(17rem,24vw))] xl:grid-cols-[minmax(0,1fr)_minmax(210px,min(18rem,22vw))]"
        )}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden bg-[#f4f3f0] lg:border-r lg:border-neutral-200/90">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-1.5 py-1 sm:px-2">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col">
              {controls}
            </div>
          </div>
          {navigationDock ? (
            <div className="w-full shrink-0 border-t border-neutral-200/90 bg-white/90 px-1.5 py-1.5 backdrop-blur-sm sm:px-2">
              <div className="w-full min-w-0">{navigationDock}</div>
            </div>
          ) : null}
        </div>

        {previewInline ? (
          <div className="hidden min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-neutral-200/80 bg-neutral-100 lg:flex">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col items-stretch gap-1 overflow-hidden px-1 py-1">
              <div className="flex w-full shrink-0 items-center justify-between gap-1">
                <p className="text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
                  Preview
                </p>
                {previewActions}
              </div>
              <div className="flex min-h-0 w-full flex-1 items-start justify-end pr-0.5">
                {preview}
              </div>
              {channelRail ? (
                <div className="flex w-full shrink-0 justify-end pb-0.5">
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
