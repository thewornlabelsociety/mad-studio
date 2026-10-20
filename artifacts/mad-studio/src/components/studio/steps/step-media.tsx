"use client"

import { FolderOpen, Layers, Loader2, SquareDashed } from "lucide-react"

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
import { ToolIconButton } from "@/components/studio/tool-icon-button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type StepMediaBridgePayload = {
  spokenHook: string
  onScreenHeadline: string
  caption: string
  destinationUrl: string | null
}

type Props = {
  entityId: string
  brandName?: string
  industry?: string | null
  marketingEntityId?: string | null
  assets: MediaAsset[]
  activeId: string | null
  onAssetsChange: (assets: MediaAsset[]) => void
  onSelectMedia: (asset: MediaAsset) => void
  onIntakeAssetsAdded?: (assets: MediaAsset[]) => void
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
  /** Story card styling, shown while the cutout is on. */
  storyCard?: {
    swatches: ReadonlyArray<{ hex: string; label: string }>
    background: string
    onBackgroundChange: (hex: string) => void
    scale: number
    onScaleChange: (scale: number) => void
    offsetY: number
    onOffsetYChange: (offsetY: number) => void
  } | null
  /** Cut out every photo in the carousel (2+ photos). */
  onCutoutAll?: () => void
  /** Suggested new arrivals, shown under the tools. */
  suggestionsSlot?: React.ReactNode
}

export function StepMedia({
  entityId,
  brandName,
  industry = null,
  marketingEntityId = null,
  assets,
  activeId,
  onAssetsChange,
  onSelectMedia,
  onIntakeAssetsAdded,
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
  storyCard = null,
  suggestionsSlot = null,
  onCutoutAll,
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
        brandName={brandName}
        industry={industry}
        inventoryItemId={marketingEntityId}
        assets={assets}
        activeId={activeId}
        onAssetsChange={onAssetsChange}
        onSelectMedia={onSelectMedia}
        onIntakeAssetsAdded={onIntakeAssetsAdded}
        onVisualInspect={onVisualInspect}
        disabled={disabled}
      />

      {/* Editing tools — icons only, labelled on hover. */}
      <TooltipProvider>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="toolbar" aria-label="Media tools">
          <ToolIconButton
            label="Media library"
            hint="Pick photos and reels — choose 2 or more for a carousel."
            onClick={onOpenMediaLibrary}
            disabled={disabled}
            icon={<FolderOpen className="size-5" />}
          />
          <CapCutBridge
            iconOnly
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
          <PhotoRoomBridge iconOnly />
          {!isVideo && active ? (
            <ToolIconButton
              label={cutoutActive ? "Cutout on — click to undo" : "Cut out item"}
              hint={
                cutoutActive
                  ? "Your Instagram Story shows the item on your brand colour."
                  : "Removes the background for your Instagram Story card."
              }
              active={cutoutActive}
              disabled={disabled || cutoutDisabled || cutoutBusy}
              onClick={() => onCutoutToggle?.()}
              icon={
                cutoutBusy ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <SquareDashed className="size-5" />
                )
              }
            />
          ) : null}
          {onCutoutAll ? (
            <ToolIconButton
              label="Cut out all photos"
              hint="Removes the background on every photo in the carousel."
              disabled={disabled || cutoutDisabled || cutoutBusy}
              onClick={onCutoutAll}
              icon={<Layers className="size-5" />}
            />
          ) : null}
          <span aria-hidden className="mx-1 h-7 w-px bg-neutral-300" />
          <FinishedRenderDropZone
            iconOnly
            entityId={entityId}
            marketingEntityId={marketingEntityId}
            onReady={onFinishedRender}
          />
        </div>
      </TooltipProvider>

      {storyCard && cutoutActive ? (
        <section
          aria-label="Story card"
          className="mt-4 space-y-3 border-2 border-mad-black bg-mad-white p-3"
        >
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Story card
          </p>
          <div className="space-y-1.5">
            <span className="font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-black uppercase">
              Background
            </span>
            <div className="flex flex-wrap gap-2">
              {storyCard.swatches.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  aria-label={`Background ${swatch.label}`}
                  onClick={() => storyCard.onBackgroundChange(swatch.hex)}
                  className={cn(
                    "size-8 border-2 border-mad-black",
                    storyCard.background.toLowerCase() === swatch.hex.toLowerCase() &&
                      "ring-2 ring-mad-vermillion ring-offset-1"
                  )}
                  style={{ background: swatch.hex }}
                />
              ))}
            </div>
          </div>
          <label className="grid gap-1">
            <span className="font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-black uppercase">
              Item size ({Math.round(storyCard.scale * 100)}%)
            </span>
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.05}
              value={storyCard.scale}
              onChange={(event) => storyCard.onScaleChange(Number(event.target.value))}
              className="w-full cursor-pointer accent-mad-black"
            />
          </label>
          <label className="grid gap-1">
            <span className="font-typewriter text-[0.7rem] font-bold tracking-widest text-mad-black uppercase">
              Item position
            </span>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={storyCard.offsetY}
              onChange={(event) => storyCard.onOffsetYChange(Number(event.target.value))}
              className="w-full cursor-pointer accent-mad-black"
              aria-label="Move the item up or down"
            />
          </label>
        </section>
      ) : null}

      {visualDescription ? (
        <p className="mt-4 border-l-2 border-mad-lime pl-2 text-xs leading-relaxed text-neutral-600">
          {visualDescription}
        </p>
      ) : null}

      {suggestionsSlot}
    </StudioStepPanel>
  )
}

