"use client"

import { useState, type ReactNode } from "react"
import { AlignCenter, AlignLeft, AlignRight, Check, Plus, SlidersHorizontal } from "lucide-react"

import type { CardAlign, PillFill, PillShape } from "@/components/templates/edit-slides"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { StoryBackground } from "@/lib/brands/story-kit"
import {
  CARD_FIELDS,
  PILL_FILLS,
  PILL_SHAPES,
  type CardField,
  type StoryCardStyle,
} from "@/lib/templates/story-card-style"
import { cn } from "@/lib/utils"

/** One labelled line of a Card style panel. */
export function StyleRow({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", wide && "md:col-span-2")}>
      <span className="w-20 shrink-0 font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">{label}</span>
      {children}
    </div>
  )
}

/** Left, centre and right buttons for something on the cards. */
export function AlignButtons({ value, onChange, what }: { value: CardAlign; onChange: (next: CardAlign) => void; what: string }) {
  return (
    <div className="flex border-2 border-mad-black" role="group" aria-label={`Line up ${what}`}>
      {(
        [
          { side: "left", label: "Left", Icon: AlignLeft },
          { side: "center", label: "Centre", Icon: AlignCenter },
          { side: "right", label: "Right", Icon: AlignRight },
        ] as const
      ).map(({ side, label, Icon }) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          aria-pressed={value === side}
          title={`${label}-align ${what}`}
          aria-label={`${label}-align ${what}`}
          className={cn("flex size-7 items-center justify-center", value === side ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]")}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}

/** Tick on and off what every card shows. */
export function CardFieldToggles({
  value,
  onToggle,
}: {
  value: Record<CardField, boolean>
  onToggle: (field: CardField) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="On the cards">
      {CARD_FIELDS.map((field) => (
        <button
          key={field.id}
          type="button"
          onClick={() => onToggle(field.id)}
          aria-pressed={value[field.id]}
          title={value[field.id] ? `Hide ${field.label.toLowerCase()} on the cards` : `Show ${field.label.toLowerCase()} on the cards`}
          className={cn(
            "flex h-7 items-center gap-1 rounded-full border-2 border-mad-black px-2.5 text-[11px] uppercase tracking-wider",
            value[field.id] ? "bg-mad-black text-mad-white" : "border-dashed text-mad-black/70 hover:bg-[#F4EFE6]"
          )}
        >
          {value[field.id] ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
          {field.label}
        </button>
      ))}
    </div>
  )
}

/** The fabric pill's line-up, colour and shape. */
export function PillControls({
  background,
  align,
  fill,
  shape,
  onAlign,
  onFill,
  onShape,
}: {
  background: StoryBackground
  align: CardAlign
  fill: PillFill
  shape: PillShape
  onAlign: (next: CardAlign) => void
  onFill: (next: PillFill) => void
  onShape: (next: PillShape) => void
}) {
  return (
    <>
      <AlignButtons value={align} onChange={onAlign} what="the fabric pill" />
      <div className="flex items-center gap-1" role="group" aria-label="Pill colour">
        {PILL_FILLS.map((option) => {
          const look =
            option.id === "outline"
              ? { background: "transparent", borderColor: background.text_color }
              : option.id === "accent"
                ? { background: background.accent_color, borderColor: background.accent_color }
                : option.id === "ink"
                  ? { background: background.text_color, borderColor: background.text_color }
                  : { background: "#F4F1EA", borderColor: "#F4F1EA" }
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFill(option.id)}
              aria-pressed={fill === option.id}
              title={`${option.label} pill`}
              aria-label={`${option.label} pill`}
              className={cn("flex size-7 items-center justify-center rounded-full", fill === option.id && "ring-2 ring-mad-black ring-offset-1")}
              style={{ background: background.color }}
            >
              <span className="block h-3 w-5 rounded-full border-2" style={look} />
            </button>
          )
        })}
      </div>
      <div className="flex border-2 border-mad-black" role="group" aria-label="Pill shape">
        {PILL_SHAPES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onShape(option.id)}
            aria-pressed={shape === option.id}
            title={`${option.label} pill`}
            aria-label={`${option.label} pill`}
            className={cn("flex h-7 w-9 items-center justify-center", shape === option.id ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]")}
          >
            <span
              aria-hidden
              className="block h-3 w-5 border-2 border-current"
              style={{ borderRadius: option.id === "round" ? 999 : option.id === "soft" ? 3 : 0 }}
            />
          </button>
        ))}
      </div>
    </>
  )
}

/** A Card style button for the Story screens: the same choices as the Themed edit, for every Story card. */
export function StoryCardStyleMenu({
  style,
  onChange,
  background,
  className,
}: {
  style: StoryCardStyle
  onChange: (next: StoryCardStyle) => void
  /** A Story's colours, to preview the pill choices. */
  background: StoryBackground
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Card style: what shows on every Story and how it lines up"
          aria-label="Card style"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center border-2 border-mad-black bg-white hover:bg-[#F4EFE6]",
            className
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] rounded-none border-2 border-mad-black p-3">
        <p className="mb-3 font-typewriter text-[11px] font-bold uppercase tracking-widest">Card style</p>
        <div className="flex flex-col gap-3">
          <StyleRow label="Words">
            <AlignButtons value={style.align} onChange={(align) => onChange({ ...style, align })} what="the words" />
          </StyleRow>
          <StyleRow label="Show">
            <CardFieldToggles
              value={style.fields}
              onToggle={(field) => onChange({ ...style, fields: { ...style.fields, [field]: !style.fields[field] } })}
            />
          </StyleRow>
          <StyleRow label="Fabric pill">
            <PillControls
              background={background}
              align={style.pillAlign}
              fill={style.pillFill}
              shape={style.pillShape}
              onAlign={(pillAlign) => onChange({ ...style, pillAlign })}
              onFill={(pillFill) => onChange({ ...style, pillFill })}
              onShape={(pillShape) => onChange({ ...style, pillShape })}
            />
          </StyleRow>
          <p className="text-xs text-mad-black/60">Applies to every Story: Today, the Story screen and the Sale rack.</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Quick picks for a piece's fabric pill; anything else can be typed. */
export const FABRIC_PICKS = ["Linen", "Silk", "Cotton", "Wool", "Cashmere", "Leather", "Denim", "Satin", "Lace", "Velvet", "Viscose", "Suede"]

/** The fabric the shop listing names, if any (its "Material:" line, or a known fabric in the text). */
export function listingFabric(text: string): string | null {
  const material = text.match(/Material:\s*([^·\n]+)/i)?.[1]?.trim()
  if (material) return material.split(/[,/]/)[0].trim().slice(0, 20) || null
  const known = FABRIC_PICKS.find((fabric) => new RegExp(`\\b${fabric}\\b`, "i").test(text))
  return known ?? null
}

/** Click to set a piece's fabric: a suggestion from the listing, quick picks, or your own word. */
export function FabricPicker({
  value,
  suggestion,
  pieceName,
  onChange,
}: {
  value: string | null
  suggestion: string | null
  pieceName: string
  onChange: (next: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState("")
  const picks = suggestion && !FABRIC_PICKS.some((pick) => pick.toLowerCase() === suggestion.toLowerCase())
    ? [suggestion, ...FABRIC_PICKS]
    : FABRIC_PICKS
  function choose(next: string | null) {
    onChange(next)
    setOpen(false)
    setCustom("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value ? "Change the fabric pill" : "Add a fabric pill, e.g. linen or silk"}
          aria-label={value ? `Fabric for ${pieceName}: ${value}. Change it` : `Add a fabric for ${pieceName}`}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-full border-2 border-mad-black px-2 text-[11px] uppercase tracking-wider",
            value ? "bg-mad-black text-mad-white" : "border-dashed text-mad-black/70 hover:bg-[#F4EFE6]"
          )}
        >
          {value ?? (
            <>
              <Plus className="size-3" aria-hidden /> Fabric
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-none border-2 border-mad-black p-2">
        <p className="mb-1.5 text-[11px] text-mad-black/60">
          {suggestion ? `The listing says ${suggestion.toLowerCase()}.` : "Pick the fabric, or type your own."}
        </p>
        <div className="flex flex-wrap gap-1">
          {picks.map((pick) => (
            <button
              key={pick}
              type="button"
              onClick={() => choose(pick)}
              aria-pressed={value?.toLowerCase() === pick.toLowerCase()}
              className={cn(
                "rounded-full border-2 border-mad-black px-2 py-0.5 text-[11px] uppercase tracking-wider",
                value?.toLowerCase() === pick.toLowerCase() ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]",
                pick === suggestion && "border-mad-vermillion"
              )}
            >
              {pick}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (custom.trim()) choose(custom.trim().slice(0, 20))
          }}
        >
          <input
            type="text"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="Other, e.g. Merino"
            aria-label="Type a fabric"
            maxLength={20}
            className="h-8 min-w-0 flex-1 border-2 border-mad-black px-2 text-xs"
          />
          <button type="submit" className="h-8 border-2 border-mad-black px-2 text-xs hover:bg-[#F4EFE6]">
            Add
          </button>
        </form>
        {value ? (
          <button type="button" onClick={() => choose(null)} className="mt-2 text-[11px] underline">
            No fabric pill
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
