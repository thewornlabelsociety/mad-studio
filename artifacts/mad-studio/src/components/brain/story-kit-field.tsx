"use client"

import { Plus, RotateCcw, Trash2 } from "lucide-react"

import {
  contrastRatio,
  readableTextOn,
  STORY_ITEM_TRAITS,
  STORY_KIT_DARK_TEXT,
  STORY_KIT_LIGHT_TEXT,
  type StoryBackground,
} from "@/lib/brands/story-kit"
import { cn } from "@/lib/utils"

const MAX_BACKGROUNDS = 5

type Props = {
  kit: StoryBackground[]
  /** The kit this brand starts from, for Reset. */
  defaults: StoryBackground[]
  onChange: (kit: StoryBackground[]) => void
}

/** Five named Story backgrounds, each with its text colour and the items it suits. */
export function StoryKitField({ kit, defaults, onChange }: Props) {
  function update(index: number, patch: Partial<StoryBackground>) {
    onChange(kit.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function toggleSuit(index: number, trait: string) {
    const suits = kit[index].suits ?? []
    update(index, {
      suits: suits.includes(trait)
        ? suits.filter((id) => id !== trait)
        : [...suits, trait],
    })
  }

  function add() {
    const color = "#5C5C54"
    onChange([
      ...kit,
      {
        id: `bg_${Date.now().toString(36)}`,
        name: `Background ${kit.length + 1}`,
        color,
        text_color: readableTextOn(color),
        accent_color: readableTextOn(color),
        suits: [],
      },
    ])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest uppercase">
            Story backgrounds
          </p>
          <p className="mt-1 max-w-xl text-xs text-neutral-600">
            New arrival Stories use one of these per item, matched to what the
            item suits. Layout and font never change.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange(defaults)}
          title="Reset to the starting kit"
          aria-label="Reset Story backgrounds to the starting kit"
          className="flex size-8 items-center justify-center border-2 border-mad-black hover:bg-mad-black hover:text-mad-white"
        >
          <RotateCcw className="size-3.5" aria-hidden />
        </button>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kit.map((row, index) => {
          const weak = contrastRatio(row.color, row.text_color) < 3
          return (
            <li key={row.id} className="grid gap-2 border-2 border-mad-black/20 p-3">
              <div
                className="flex aspect-[9/5] items-end justify-between rounded-sm px-3 py-2"
                style={{ background: row.color, color: row.text_color }}
              >
                <span className="font-semibold uppercase tracking-[0.18em]" style={{ fontFamily: "'Josefin Sans', system-ui, sans-serif" }}>
                  {row.name || "Untitled"}
                </span>
                <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: row.accent_color }}>
                  New in
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id={`kit-color-${row.id}`}
                  type="color"
                  value={row.color}
                  onChange={(event) => update(index, { color: event.target.value.toUpperCase() })}
                  className="size-9 shrink-0 cursor-pointer border-2 border-mad-black"
                  aria-label={`${row.name} colour`}
                />
                <input
                  id={`kit-name-${row.id}`}
                  type="text"
                  value={row.name}
                  maxLength={40}
                  onChange={(event) => update(index, { name: event.target.value })}
                  className="h-9 min-w-0 flex-1 border-2 border-mad-black px-2 text-sm"
                  aria-label="Background name"
                />
                <button
                  type="button"
                  onClick={() => onChange(kit.filter((_, i) => i !== index))}
                  disabled={kit.length <= 1}
                  title="Remove this background"
                  aria-label={`Remove ${row.name}`}
                  className="flex size-9 shrink-0 items-center justify-center border-2 border-mad-black/30 text-neutral-600 hover:border-mad-black hover:text-mad-black disabled:opacity-30"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-neutral-600">Text</span>
                {[STORY_KIT_LIGHT_TEXT, STORY_KIT_DARK_TEXT].map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => update(index, { text_color: hex })}
                    title={hex === STORY_KIT_LIGHT_TEXT ? "Cream text" : "Charcoal text"}
                    aria-label={hex === STORY_KIT_LIGHT_TEXT ? "Cream text" : "Charcoal text"}
                    aria-pressed={row.text_color === hex}
                    className={cn(
                      "size-6 rounded-full border border-black/20",
                      row.text_color === hex && "ring-2 ring-mad-black ring-offset-1"
                    )}
                    style={{ background: hex }}
                  />
                ))}
                <span className="ml-2 text-neutral-600">Accent</span>
                <input
                  id={`kit-accent-${row.id}`}
                  type="color"
                  value={row.accent_color}
                  onChange={(event) => update(index, { accent_color: event.target.value.toUpperCase() })}
                  className="size-6 cursor-pointer border border-black/20"
                  aria-label={`${row.name} accent colour`}
                />
                {weak ? (
                  <span className="basis-full text-[11px] text-mad-vermillion">
                    Hard to read. Try the other text colour.
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1">
                {STORY_ITEM_TRAITS.map((trait) => {
                  const on = (row.suits ?? []).includes(trait.id)
                  return (
                    <button
                      key={trait.id}
                      type="button"
                      onClick={() => toggleSuit(index, trait.id)}
                      aria-pressed={on}
                      className={cn(
                        "border px-2 py-0.5 text-[11px]",
                        on
                          ? "border-mad-black bg-mad-black text-mad-white"
                          : "border-mad-black/25 text-neutral-600 hover:border-mad-black"
                      )}
                    >
                      {trait.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
        {kit.length < MAX_BACKGROUNDS ? (
          <li>
            <button
              type="button"
              onClick={add}
              className="flex h-full min-h-32 w-full items-center justify-center gap-2 border-2 border-dashed border-mad-black/40 text-sm text-neutral-600 hover:border-mad-black hover:text-mad-black"
            >
              <Plus className="size-4" aria-hidden /> Add a background
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
