"use client"

import {
  resolveFudiTrackPresets,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import type { StudioIntentChip } from "@/lib/studio/entity-presets"
import { cn } from "@/lib/utils"

type IntentMatrixProps = {
  showFudiTracks: boolean
  fudiTrack: FudiAudienceTrack
  onFudiTrackChange: (track: FudiAudienceTrack) => void
  intentChips: StudioIntentChip[]
  intentChipId: string
  onIntentChipSelect: (chip: StudioIntentChip) => void
  outputFormats?: string[]
}

export function IntentMatrix({
  showFudiTracks,
  fudiTrack,
  onFudiTrackChange,
  intentChips,
  intentChipId,
  onIntentChipSelect,
  outputFormats = [],
}: IntentMatrixProps) {
  const trackPresets = showFudiTracks
    ? resolveFudiTrackPresets(fudiTrack)
    : null

  return (
    <div className="space-y-4">
      {showFudiTracks ? (
        <div className="space-y-2">
          <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
            Audience track
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "diners" as const,
                  emoji: "🍽",
                  label: "Track A: Diners & Foodies",
                },
                {
                  id: "partners" as const,
                  emoji: "🏢",
                  label: "Track B: Eatery Partners (B2B)",
                },
              ] as const
            ).map((option) => {
              const active = fudiTrack === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onFudiTrackChange(option.id)}
                  className={cn(
                    "border-2 border-mad-black px-3 py-2.5 text-left font-typewriter text-[0.65rem] font-bold tracking-wider uppercase transition-colors",
                    active
                      ? "bg-mad-black text-mad-white shadow-keycap-sm"
                      : "bg-mad-white text-mad-black hover:bg-mad-lime"
                  )}
                >
                  <span className="mr-1.5" aria-hidden>
                    {option.emoji}
                  </span>
                  {option.label}
                </button>
              )
            })}
          </div>
          {trackPresets ? (
            <p className="text-xs leading-relaxed text-neutral-600">
              Formats: {trackPresets.outputFormats.join(" · ")}. Default
              persona: {trackPresets.defaultPersonaName}.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {intentChips.map((chip) => {
          const active = intentChipId === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onIntentChipSelect(chip)}
              className={cn(
                "border-2 border-mad-black px-2 py-3 text-left font-typewriter text-[0.65rem] font-bold tracking-wider uppercase transition-colors",
                active
                  ? "bg-mad-black text-mad-white shadow-keycap-sm"
                  : "bg-mad-white text-mad-black hover:bg-mad-lime"
              )}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {outputFormats.length > 0 ? (
        <div className="border-t-2 border-mad-black pt-3">
          <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
            Output emphasis
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {outputFormats.map((format) => (
              <li
                key={format}
                className="border border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase"
              >
                {format}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
