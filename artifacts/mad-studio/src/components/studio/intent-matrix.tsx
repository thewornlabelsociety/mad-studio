"use client"

import {
  AUDIENCE_TONE_META,
  AUDIENCE_TONES,
  type AudienceTone,
} from "@/lib/studio/audience-tone"
import type { StudioIntentChip } from "@/lib/studio/entity-presets"
import { cn } from "@/lib/utils"

type IntentMatrixProps = {
  audienceTone: AudienceTone
  onAudienceToneChange: (tone: AudienceTone) => void
  intentChips: StudioIntentChip[]
  intentChipId: string
  onIntentChipSelect: (chip: StudioIntentChip) => void
  outputFormats?: string[]
}

export function IntentMatrix({
  audienceTone,
  onAudienceToneChange,
  intentChips,
  intentChipId,
  onIntentChipSelect,
  outputFormats = [],
}: IntentMatrixProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
          Audience tone
        </p>
        <div className="grid grid-cols-1 gap-2">
          {AUDIENCE_TONES.map((tone) => {
            const meta = AUDIENCE_TONE_META[tone]
            const active = audienceTone === tone
            return (
              <button
                key={tone}
                type="button"
                onClick={() => onAudienceToneChange(tone)}
                className={cn(
                  "border-2 border-mad-black px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-mad-black text-mad-white shadow-keycap-sm"
                    : "bg-mad-white text-mad-black hover:bg-mad-lime"
                )}
              >
                <p className="font-typewriter text-[0.65rem] font-bold tracking-wider uppercase">
                  {meta.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[0.65rem] leading-relaxed normal-case",
                    active ? "text-white/75" : "text-neutral-600"
                  )}
                >
                  {meta.promptCue}
                </p>
              </button>
            )
          })}
        </div>
      </div>

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
