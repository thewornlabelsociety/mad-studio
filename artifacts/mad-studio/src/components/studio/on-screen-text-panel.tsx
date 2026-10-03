"use client"

import { AutoTextarea } from "@/components/studio/auto-textarea"
import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"
import {
  clampCanvasTextRotationDeg,
  resolveCanvasTextRotationDeg,
} from "@/lib/studio/canvas-text-layout"
import { cn } from "@/lib/utils"

const ROTATION_PRESETS = [
  { label: "-12° Tilt", value: -12 },
  { label: "-6° Subtle", value: -6 },
  { label: "0° Level", value: 0 },
  { label: "+6° Subtle", value: 6 },
  { label: "+12° Tilt", value: 12 },
] as const

type Props = {
  value: CanvasTextOverlayState
  onChange: (next: CanvasTextOverlayState) => void
}

export function OnScreenTextPanel({ value, onChange }: Props) {
  const rotationDeg = resolveCanvasTextRotationDeg(value)

  function patch(partial: Partial<CanvasTextOverlayState>) {
    onChange({ ...value, ...partial })
  }

  return (
    <div className="space-y-2 border-t-2 border-mad-black/15 pt-3">
      <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
        [ On-Screen Text ]
      </p>
      <p className="text-[0.65rem] leading-snug text-neutral-600">
        Updates the Remotion phone preview instantly. Hook above drives the 0–3s
        kinetic word reveal. For static exports, open the Canvas step to style
        headline/subhead (font, shadow, highlight) — that text bakes into the PNG;
        polls and link stickers stay native on your phone.
      </p>
      <label className="block space-y-1">
        <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Headline on media
        </span>
        <AutoTextarea
          value={value.headline}
          onValueChange={(headline) =>
            patch({ headline, enabled: headline.trim().length > 0 || value.subhead.trim().length > 0 })
          }
          rows={1}
          placeholder="REFRESHING · NEW DROP"
          className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-sm font-semibold uppercase focus:bg-mad-lime/20"
        />
      </label>
      <label className="block space-y-1">
        <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Subhead
        </span>
        <AutoTextarea
          value={value.subhead}
          onValueChange={(subhead) =>
            patch({ subhead, enabled: value.headline.trim().length > 0 || subhead.trim().length > 0 })
          }
          rows={1}
          placeholder="Optional second line"
          className="rounded-none border-2 border-mad-black bg-mad-white px-2 py-1.5 text-sm focus:bg-mad-lime/20"
        />
      </label>

      <div className="space-y-1.5 border-t border-mad-black/10 pt-2">
        <span className="font-typewriter text-[0.5rem] font-bold tracking-wider text-neutral-500 uppercase">
          Tilt ({Math.round(rotationDeg)}°)
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ROTATION_PRESETS.map((preset) => {
            const isActive = rotationDeg === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  patch({
                    rotationDeg: clampCanvasTextRotationDeg(preset.value),
                    enabled:
                      value.enabled ||
                      Boolean(value.headline.trim() || value.subhead.trim()),
                  })
                }
                className={cn(
                  "shrink-0 rounded-md border px-2.5 py-1 font-mono text-xs font-medium transition-all",
                  isActive
                    ? "border-mad-black bg-mad-black text-[#CCFF00] shadow-[1px_1px_0px_#000]"
                    : "border-neutral-200 bg-mad-white text-neutral-700 hover:border-mad-black"
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotationDeg}
          onChange={(event) =>
            patch({
              rotationDeg: clampCanvasTextRotationDeg(Number(event.target.value)),
            })
          }
          className="w-full touch-pan-y"
          aria-label="On-screen text rotation"
        />
      </div>
    </div>
  )
}
