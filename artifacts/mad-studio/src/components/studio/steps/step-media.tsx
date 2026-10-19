"use client"

import { Loader2, Scissors } from "lucide-react"

import {
  MediaTray,
  type MediaAsset,
} from "@/components/marketing/media-tray"
import { CapCutBridge } from "@/components/studio/capcut-bridge"
import { FinishedRenderDropZone } from "@/components/studio/finished-render-drop"
import { PhotoRoomBridge } from "@/components/studio/photoroom-bridge"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import type { MediaKind } from "@/lib/media/kind"
import { StudioStepPanel } from "@/components/studio/studio-step-panel"
import { cn } from "@/lib/utils"

export type StepMediaBridgePayload = {
  spokenHook: string
  onScreenHeadline: string
  caption: string
  destinationUrl: string | null
}

type Props = {
  entityId: string
  marketingEntityId?: string | null
  assets: MediaAsset[]
  activeId: string | null
  onAssetsChange: (assets: MediaAsset[]) => void
  onSelectMedia: (asset: MediaAsset) => void
  onVisualInspect?: (
    assetId: string,
    inspection: MediaVisualInspection | null
  ) => void
  bridgePayload: StepMediaBridgePayload
  onFinishedRender: (publicUrl: string, kind: MediaKind) => void
  onOpenMediaLibrary: () => void
  disabled?: boolean
  visualDescription?: string | null
  cutoutActive?: boolean
  cutoutBusy?: boolean
  onCutoutToggle?: () => void
  cutoutDisabled?: boolean
}

export function StepMedia({
  entityId,
  marketingEntityId = null,
  assets,
  activeId,
  onAssetsChange,
  onSelectMedia,
  onVisualInspect,
  bridgePayload,
  onFinishedRender,
  onOpenMediaLibrary,
  disabled = false,
  visualDescription = null,
  cutoutActive = false,
  cutoutBusy = false,
  onCutoutToggle,
  cutoutDisabled = false,
}: Props) {
  const active = assets.find((row) => row.id === activeId) ?? assets[0] ?? null
  const isVideo = active?.type === "video"

  return (
    <StudioStepPanel
      fill
      kicker="I · Media"
      title="Photos, reels & library"
      description="Attach stills or reels, pull from the brand library, or drop a finished render."
    >
      <MediaTray
        entityId={entityId}
        inventoryItemId={marketingEntityId}
        assets={assets}
        activeId={activeId}
        onAssetsChange={onAssetsChange}
        onSelectMedia={onSelectMedia}
        onVisualInspect={onVisualInspect}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={onOpenMediaLibrary}
        disabled={disabled}
        className="rounded-sm border border-neutral-300 bg-mad-black px-4 py-2.5 text-xs font-medium tracking-wide text-mad-white uppercase hover:bg-neutral-800 disabled:opacity-50"
      >
        📁 Open media library
      </button>

      {!isVideo && active ? (
        <button
          type="button"
          disabled={disabled || cutoutDisabled || cutoutBusy}
          onClick={() => onCutoutToggle?.()}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-neutral-300 text-xs font-medium tracking-wide uppercase",
            cutoutActive
              ? "border-mad-black bg-mad-black text-mad-white"
              : "bg-white hover:bg-neutral-50",
            cutoutDisabled && "opacity-40"
          )}
        >
          {cutoutBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Scissors className="size-4" />
          )}
          {cutoutActive ? "Cutout on · reset" : "✂ Cutout / isolate subject"}
        </button>
      ) : null}

      {visualDescription ? (
        <p className="line-clamp-2 font-typewriter text-[0.5rem] leading-relaxed text-neutral-600 normal-case">
          {visualDescription}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <CapCutBridge
          payload={{
            hook: bridgePayload.spokenHook,
            headline: bridgePayload.onScreenHeadline,
            caption: bridgePayload.caption,
            audioScript: bridgePayload.spokenHook,
            assetUrl: active?.url ?? null,
            destinationUrl: bridgePayload.destinationUrl,
            spokenHook: bridgePayload.spokenHook,
            onScreenHeadline: bridgePayload.onScreenHeadline,
          }}
        />
        <PhotoRoomBridge />
      </div>

      <FinishedRenderDropZone
        entityId={entityId}
        marketingEntityId={marketingEntityId}
        onReady={onFinishedRender}
      />
    </StudioStepPanel>
  )
}

