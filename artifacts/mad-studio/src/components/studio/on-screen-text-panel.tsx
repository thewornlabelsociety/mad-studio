"use client"

import { AutoTextarea } from "@/components/studio/auto-textarea"
import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"

type Props = {
  value: CanvasTextOverlayState
  onChange: (next: CanvasTextOverlayState) => void
}

export function OnScreenTextPanel({ value, onChange }: Props) {
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
    </div>
  )
}
