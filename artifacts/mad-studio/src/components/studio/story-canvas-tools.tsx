"use client"

import { Layers, Loader2, SquareDashed } from "lucide-react"

import { CapCutBridge } from "@/components/studio/capcut-bridge"
import { PhotoRoomBridge } from "@/components/studio/photoroom-bridge"
import { ToolIconButton } from "@/components/studio/tool-icon-button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type StoryCanvasToolsBridge = {
  spokenHook: string
  onScreenHeadline: string
  caption: string
  destinationUrl: string | null
  assetUrl: string | null
}

export type StoryCardControls = {
  swatches: ReadonlyArray<{ hex: string; label: string }>
  background: string
  onBackgroundChange: (hex: string) => void
  scale: number
  onScaleChange: (scale: number) => void
  offsetY: number
  onOffsetYChange: (offsetY: number) => void
}

type Props = {
  bridge: StoryCanvasToolsBridge
  cutoutActive?: boolean
  cutoutBusy?: boolean
  cutoutDisabled?: boolean
  onCutoutToggle?: () => void
  onCutoutAll?: () => void
  isVideo?: boolean
  hasPhoto?: boolean
  storyCard?: StoryCardControls | null
  disabled?: boolean
}

/** CapCut / PhotoRoom / Cutout + Story card — lives on the Canvas step. */
export function StoryCanvasTools({
  bridge,
  cutoutActive = false,
  cutoutBusy = false,
  cutoutDisabled = false,
  onCutoutToggle,
  onCutoutAll,
  isVideo = false,
  hasPhoto = false,
  storyCard = null,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-3 border-2 border-mad-black bg-mad-white p-3">
      <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Cut out and background
      </p>
      <TooltipProvider>
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Story and edit tools"
        >
          <CapCutBridge
            iconOnly
            payload={{
              hook: bridge.spokenHook,
              headline: bridge.onScreenHeadline,
              caption: bridge.caption,
              audioScript: bridge.spokenHook,
              assetUrl: bridge.assetUrl,
              destinationUrl: bridge.destinationUrl,
              spokenHook: bridge.spokenHook,
              onScreenHeadline: bridge.onScreenHeadline,
            }}
          />
          <PhotoRoomBridge iconOnly />
          {!isVideo && hasPhoto && onCutoutToggle ? (
            <ToolIconButton
              label={cutoutActive ? "Cutout on — click to undo" : "Cut out item"}
              hint={
                cutoutActive
                  ? "Your Instagram Story shows the item on your brand colour."
                  : "Removes the background for your Instagram Story card."
              }
              active={cutoutActive}
              disabled={disabled || cutoutDisabled || cutoutBusy}
              onClick={() => onCutoutToggle()}
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
        </div>
      </TooltipProvider>

      {storyCard && cutoutActive ? (
        <section aria-label="Story card" className="space-y-3 border-t-2 border-mad-black/20 pt-3">
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-black uppercase">
            Story background
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
              onChange={(event) =>
                storyCard.onScaleChange(Number(event.target.value))
              }
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
              onChange={(event) =>
                storyCard.onOffsetYChange(Number(event.target.value))
              }
              className="w-full cursor-pointer accent-mad-black"
              aria-label="Move the item up or down"
            />
          </label>
        </section>
      ) : cutoutActive ? null : (
        <p className="font-typewriter text-[0.68rem] leading-relaxed text-neutral-500 normal-case">
          Cut out the item to put it on a brand background.
        </p>
      )}
    </div>
  )
}
