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
          previewInline &&
            "lg:grid-cols-[minmax(0,1fr)_minmax(300px,min(28rem,36vw))] xl:grid-cols-[minmax(0,1fr)_minmax(320px,min(30rem,34vw))]"
        )}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden bg-[#f4f3f0] lg:border-r lg:border-neutral-200/90">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-2 sm:px-5 lg:px-5 xl:px-6">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col">
              {controls}
            </div>
          </div>
          {navigationDock ? (
            <div className="w-full shrink-0 border-t border-neutral-200/90 bg-white/90 px-4 py-2.5 backdrop-blur-sm sm:px-5 lg:px-5 xl:px-6">
              <div className="w-full min-w-0">{navigationDock}</div>
            </div>
          ) : null}
        </div>

        {previewInline ? (
          <div className="hidden min-h-0 w-full min-w-0 flex-col overflow-hidden border-l border-neutral-200/80 bg-neutral-50/90 lg:flex">
            <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-2 py-2 lg:px-3">
              <div className="flex w-full shrink-0 items-center justify-center gap-2">
                <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
                  Live preview
                </p>
                {previewActions}
              </div>
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                {preview}
              </div>
              {channelRail ? (
                <div className="flex w-full shrink-0 justify-center pb-1">
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
