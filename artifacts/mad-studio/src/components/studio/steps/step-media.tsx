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
    <section className="space-y-3 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
      <div>
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Step 1 · Media
        </p>
        <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
          Photos, reels & library
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
          Attach stills or MP4 clips — cutout and external edits happen here.
        </p>
      </div>

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
        className="border-2 border-mad-black bg-[#CCFF00] px-3 py-2 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm hover:bg-mad-lime disabled:opacity-50"
      >
        📁 Open media library
      </button>

      {!isVideo && active ? (
        <button
          type="button"
          disabled={disabled || cutoutDisabled || cutoutBusy}
          onClick={() => onCutoutToggle?.()}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 border-2 border-mad-black font-typewriter text-[0.55rem] font-bold tracking-wider uppercase shadow-keycap-sm",
            cutoutActive
              ? "bg-mad-black text-mad-white"
              : "bg-mad-white hover:bg-mad-lime",
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
          entityId={entityId}
          marketingEntityId={marketingEntityId}
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
          onVideoReady={(publicUrl) => onFinishedRender(publicUrl, "video")}
        />
        <PhotoRoomBridge />
      </div>

      <FinishedRenderDropZone
        entityId={entityId}
        marketingEntityId={marketingEntityId}
        onReady={onFinishedRender}
      />
    </section>
  )
}
