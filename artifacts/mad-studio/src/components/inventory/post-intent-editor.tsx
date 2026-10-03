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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  FUDI_DROP_KIND_OPTIONS,
  type PostIntentState,
} from "@/lib/inventory/post-intent"
import type { FudiDropKind } from "@/lib/today/agenda"
import { cn } from "@/lib/utils"

const SELECT_CUSTOM = "__custom__"

const INTENT_SELECT_TRIGGER =
  "h-9 w-full max-w-full min-w-0 overflow-hidden rounded-none border-2 border-mad-black text-xs shadow-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"

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
        "w-full border-2 border-mad-black bg-mad-white px-2 py-1 font-sans text-base normal-case tracking-normal outline-none focus:bg-mad-lime/20 md:text-sm",
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
  aiSuggested?: Partial<Record<"dropType" | "listingVibe", boolean>>
  onManualFieldChange?: (field: "dropType" | "listingVibe") => void
}

function listingVibeMatchesOption(listingVibe: string, vibeOptions: string[]) {
  const trimmed = listingVibe.trim()
  if (!trimmed) return null
  return (
    vibeOptions.find((v) => v.toLowerCase() === trimmed.toLowerCase()) ?? null
  )
}

const AI_SELECT_TINT =
  "bg-[#CCFF00]/10 ring-1 ring-inset ring-[#CCFF00]/45 [&_[data-slot=select-value]]:flex-1"

export function PostIntentEditor({
  isFudi,
  vibeOptions,
  value,
  onChange,
  className,
  aiSuggested = {},
  onManualFieldChange,
}: Props) {
  const [listingCustom, setListingCustom] = useState(
    () =>
      Boolean(value.listingVibe.trim()) &&
      !listingVibeMatchesOption(value.listingVibe, vibeOptions)
  )
  const [dropCustom, setDropCustom] = useState(
    () => !value.dropKind && Boolean(value.channelHint.trim())
  )

  const matchedListingVibe = listingVibeMatchesOption(
    value.listingVibe,
    vibeOptions
  )
  const vibeSelectValue = listingCustom
    ? SELECT_CUSTOM
    : (matchedListingVibe ??
        (value.listingVibe.trim() || vibeOptions[0] || SELECT_CUSTOM))

  const dropSelectValue = dropCustom
    ? SELECT_CUSTOM
    : value.dropKind ??
      FUDI_DROP_KIND_OPTIONS[0]?.id ??
      SELECT_CUSTOM

  useEffect(() => {
    const trimmed = value.listingVibe.trim()
    if (!trimmed) return
    if (!listingVibeMatchesOption(trimmed, vibeOptions)) {
      setListingCustom(true)
    }
  }, [value.listingVibe, vibeOptions])

  useEffect(() => {
    if (!isFudi) return
    if (value.channelHint.trim() && !value.dropKind) {
      setDropCustom(true)
    }
  }, [isFudi, value.channelHint, value.dropKind])

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
        What this drop is about — saved with your draft. Channel targeting is
        chosen on Schedule.
      </p>

      {isFudi ? (
        <label className="grid min-w-0 gap-1">
          <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
            Drop type
          </span>
          <Select
            value={dropSelectValue}
            onValueChange={(next) => {
              onManualFieldChange?.("dropType")
              if (next === SELECT_CUSTOM) {
                setDropCustom(true)
                onChange((prev) => ({ ...prev, dropKind: null }))
                return
              }
              setDropCustom(false)
              onChange((prev) => ({
                ...prev,
                dropKind: next as FudiDropKind,
                channelHint: "",
              }))
            }}
          >
            <SelectTrigger
              className={cn(
                INTENT_SELECT_TRIGGER,
                aiSuggested.dropType && AI_SELECT_TINT
              )}
            >
              <SelectValue placeholder="Drop type" />
              {aiSuggested.dropType ? (
                <span className="shrink-0 text-xs" aria-hidden>
                  ✨
                </span>
              ) : null}
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="z-[100] rounded-none border-2 border-mad-black"
            >
              {FUDI_DROP_KIND_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.emoji} {option.label}
                </SelectItem>
              ))}
              <SelectItem value={SELECT_CUSTOM}>Custom…</SelectItem>
            </SelectContent>
          </Select>
          {dropSelectValue === SELECT_CUSTOM ? (
            <PostIntentTextField
              value={value.channelHint}
              onValueChange={(channelHint) =>
                onChange((prev) => ({ ...prev, channelHint, dropKind: null }))
              }
              placeholder="Describe custom drop type…"
            />
          ) : null}
        </label>
      ) : null}

      <label className="grid min-w-0 gap-1">
        <span className="font-typewriter text-[0.45rem] font-bold tracking-wider text-neutral-500 uppercase">
          Listing vibe
        </span>
        <Select
          value={vibeSelectValue}
          onValueChange={(next) => {
            onManualFieldChange?.("listingVibe")
            if (next === SELECT_CUSTOM) {
              setListingCustom(true)
              onChange((prev) => ({ ...prev, listingVibe: "" }))
              return
            }
            setListingCustom(false)
            onChange((prev) => ({ ...prev, listingVibe: next }))
          }}
        >
          <SelectTrigger
            className={cn(
              INTENT_SELECT_TRIGGER,
              aiSuggested.listingVibe && AI_SELECT_TINT
            )}
          >
            <SelectValue placeholder="Listing vibe" />
            {aiSuggested.listingVibe ? (
              <span className="shrink-0 text-xs" aria-hidden>
                ✨
              </span>
            ) : null}
          </SelectTrigger>
          <SelectContent
            position="popper"
            className="z-[100] rounded-none border-2 border-mad-black"
          >
            {vibeOptions.map((vibe) => (
              <SelectItem key={vibe} value={vibe}>
                {vibe}
              </SelectItem>
            ))}
            <SelectItem value={SELECT_CUSTOM}>Custom…</SelectItem>
          </SelectContent>
        </Select>
        {vibeSelectValue === SELECT_CUSTOM ? (
          <PostIntentTextField
            value={value.listingVibe}
            onValueChange={(listingVibe) =>
              onChange((prev) => ({ ...prev, listingVibe }))
            }
            placeholder="Custom vibe label…"
          />
        ) : null}
      </label>
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
