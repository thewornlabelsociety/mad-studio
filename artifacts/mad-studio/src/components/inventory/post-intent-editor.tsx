"use client"

import {
  CHANNEL_HINT_PRESETS,
  FUDI_DROP_KIND_OPTIONS,
  type PostIntentState,
} from "@/lib/inventory/post-intent"
import type { FudiDropKind } from "@/lib/today/agenda"
import { cn } from "@/lib/utils"

type Props = {
  isFudi: boolean
  vibeOptions: string[]
  value: PostIntentState
  onChange: (next: PostIntentState) => void
  className?: string
}

export function PostIntentEditor({
  isFudi,
  vibeOptions,
  value,
  onChange,
  className,
}: Props) {
  return (
    <section
      className={cn(
        "space-y-2 border-2 border-dashed border-mad-black/30 bg-mad-white/80 p-2",
        className
      )}
    >
      <p className="font-typewriter text-[0.5rem] font-bold tracking-widest text-mad-vermillion uppercase">
        Post intent
      </p>
      <p className="font-typewriter text-[0.5rem] leading-relaxed text-neutral-500 normal-case">
        Same chips as Today — edit what this drop is about and where it should
        land. Saved with your draft.
      </p>

      {isFudi ? (
        <>
          <div className="space-y-1">
            <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
              Drop type
            </span>
            <div className="flex flex-wrap gap-1">
              {FUDI_DROP_KIND_OPTIONS.map((option) => {
                const active = value.dropKind === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      onChange({ ...value, dropKind: option.id })
                    }
                    className={cn(
                      "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase transition",
                      active
                        ? "bg-[#CCFF00] text-mad-black"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    {option.emoji} {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
              Channel hint
            </span>
            <div className="flex flex-wrap gap-1">
              {CHANNEL_HINT_PRESETS.map((preset) => {
                const active = value.channelHint === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      onChange({ ...value, channelHint: preset })
                    }
                    className={cn(
                      "border border-mad-black/60 px-1.5 py-0.5 font-typewriter text-[0.45rem] font-bold tracking-wider uppercase transition",
                      active
                        ? "border-mad-black bg-mad-black text-mad-white"
                        : "bg-mad-white hover:bg-mad-lime"
                    )}
                  >
                    {preset}
                  </button>
                )
              })}
            </div>
            <input
              type="text"
              value={value.channelHint}
              onChange={(event) =>
                onChange({ ...value, channelHint: event.target.value })
              }
              placeholder="Custom channel hint…"
              className="w-full border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.55rem] uppercase outline-none focus:bg-mad-lime/20"
            />
          </div>
        </>
      ) : null}

      <div className="space-y-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Listing vibe
        </span>
        <div className="flex flex-wrap gap-1">
          {vibeOptions.map((vibe) => {
            const active =
              value.listingVibe.trim().toLowerCase() === vibe.toLowerCase()
            return (
              <button
                key={vibe}
                type="button"
                onClick={() => onChange({ ...value, listingVibe: vibe })}
                className={cn(
                  "border-2 border-mad-black px-2 py-0.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase transition",
                  active
                    ? "bg-mad-lime text-mad-black"
                    : "bg-mad-white hover:bg-mad-lime/60"
                )}
              >
                {vibe}
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={value.listingVibe}
          onChange={(event) =>
            onChange({ ...value, listingVibe: event.target.value })
          }
          placeholder="Custom vibe label…"
          className="w-full border-2 border-mad-black bg-mad-white px-2 py-1 font-typewriter text-[0.55rem] outline-none focus:bg-mad-lime/20"
        />
      </div>
    </section>
  )
}

export function initialPostIntentState(input: {
  isFudi: boolean
  item: import("@/lib/inventory/types").MarketingEntity
  defaultListingVibe: string | null
  defaultDropKind: FudiDropKind | null
  defaultChannelHint: string
}): PostIntentState {
  const listingOverride =
    input.item.copy_draft.metadata?.listing_vibe?.trim() ?? ""
  return {
    dropKind: input.isFudi
      ? (input.item.copy_draft.metadata?.drop_kind as FudiDropKind) ??
        input.defaultDropKind ??
        "dish_drop"
      : null,
    channelHint:
      input.item.copy_draft.metadata?.channel_hint?.trim() ||
      input.defaultChannelHint,
    listingVibe:
      listingOverride ||
      input.defaultListingVibe ||
      input.item.vibe?.trim() ||
      "",
  }
}
