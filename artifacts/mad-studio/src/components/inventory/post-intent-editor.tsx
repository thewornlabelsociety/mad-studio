"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react"

import {
  CHANNEL_HINT_PRESETS,
  FUDI_DROP_KIND_OPTIONS,
  type PostIntentState,
} from "@/lib/inventory/post-intent"
import type { FudiDropKind } from "@/lib/today/agenda"
import { cn } from "@/lib/utils"

/** Controlled text field — avoids typewriter letter-spacing caret bugs in Chrome. */
function PostIntentTextField({
  value,
  onValueChange,
  placeholder,
  className,
}: {
  value: string
  onValueChange: (next: string) => void
  placeholder?: string
  className?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false)
  const lastEmittedRef = useRef(value)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value)
      lastEmittedRef.current = value
      return
    }
    if (value !== lastEmittedRef.current) {
      setDraft(value)
      lastEmittedRef.current = value
    }
  }, [value])

  function commit(next: string, event: ChangeEvent<HTMLInputElement>) {
    const el = event.target
    const selStart = el.selectionStart
    const selEnd = el.selectionEnd
    setDraft(next)
    lastEmittedRef.current = next
    onValueChange(next)
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input || document.activeElement !== input) return
      if (selStart == null || selEnd == null) return
      try {
        input.setSelectionRange(selStart, selEnd)
      } catch {
        input.setSelectionRange(next.length, next.length)
      }
    })
  }

  return (
    <input
      ref={inputRef}
      type="text"
      dir="ltr"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={draft}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={() => {
        focusedRef.current = false
        lastEmittedRef.current = draft
        onValueChange(draft)
      }}
      onChange={(event) => commit(event.target.value, event)}
      className={cn(
        "w-full border-2 border-mad-black bg-mad-white px-2 py-1 font-sans text-sm normal-case tracking-normal outline-none focus:bg-mad-lime/20",
        className
      )}
    />
  )
}

type Props = {
  isFudi: boolean
  vibeOptions: string[]
  value: PostIntentState
  onChange: Dispatch<SetStateAction<PostIntentState>>
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
                      onChange((prev) => ({ ...prev, dropKind: option.id }))
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
                      onChange((prev) => ({ ...prev, channelHint: preset }))
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
            <PostIntentTextField
              value={value.channelHint}
              onValueChange={(channelHint) =>
                onChange((prev) => ({ ...prev, channelHint }))
              }
              placeholder="Custom channel hint…"
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
                onClick={() =>
                  onChange((prev) => ({ ...prev, listingVibe: vibe }))
                }
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
        <PostIntentTextField
          value={value.listingVibe}
          onValueChange={(listingVibe) =>
            onChange((prev) => ({ ...prev, listingVibe }))
          }
          placeholder="Custom vibe label…"
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
