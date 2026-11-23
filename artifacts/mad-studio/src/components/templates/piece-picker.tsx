"use client"

import { useMemo, useState } from "react"
import { Plus, Search, Tag } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { matchesQuery } from "@/lib/templates/week-outfits"

export type PickerOption = {
  id: string
  brand: string
  title: string
  detail: string
  thumb: string | null
  /** Everything searchable: title, brand, colour, category, vibe, size. */
  searchText: string
  /** In the picker's quick filter (marked down, or this week's dot). */
  markedDown?: boolean
}

/** Search the stock that fits this spot, by colour, brand or type, and pick one. */
export function PiecePicker({
  label,
  options,
  onPick,
  adding = false,
  addText,
  quiet = false,
  markedDownOnly = false,
  filterLabel,
}: {
  /** Start with only marked-down pieces showing (when there are any). */
  markedDownOnly?: boolean
  /** Name of the quick filter; "Marked down" by default. */
  filterLabel?: string
  /** e.g. "top", for the button's name and the search placeholder. */
  label: string
  /** Adds a new piece rather than swapping one out: a labelled "Add a …" button. */
  adding?: boolean
  /** Words on the add button; "Add a {label}" by default. */
  addText?: string
  /** A smaller outlined add button, for a row of them. */
  quiet?: boolean
  options: PickerOption[]
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {adding ? (
          <button
            type="button"
            title={addText ? `Search the stock: ${addText.toLowerCase()}` : `Search the stock for a ${label} to add`}
            className={
              quiet
                ? "flex h-8 items-center gap-1.5 border-2 border-mad-black bg-white px-2.5 text-xs hover:bg-[#F4EFE6]"
                : "flex h-9 items-center gap-2 border-2 border-mad-black bg-mad-black px-3 text-sm text-mad-white hover:bg-neutral-800"
            }
          >
            <Plus className="size-4" aria-hidden />
            {addText ?? `Add a ${label}`}
          </button>
        ) : (
          <button
            type="button"
            title={`Search for a ${label}`}
            aria-label={`Search for a different ${label}`}
            className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
          >
            <Search className="size-3.5" aria-hidden />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-none border-2 border-mad-black p-0">
        <PieceSearch
          label={label}
          options={options}
          markedDownOnly={markedDownOnly}
          filterLabel={filterLabel}
          onPick={(id) => {
            onPick(id)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

/** The stock search on its own: a search box and the matching pieces. */
export function PieceSearch({
  label,
  options,
  onPick,
  markedDownOnly = false,
  filterLabel = "Marked down",
}: {
  label: string
  options: PickerOption[]
  onPick: (id: string) => void
  /** Start with only marked-down pieces showing (when there are any). */
  markedDownOnly?: boolean
  /** Name of the quick filter; "Marked down" by default. */
  filterLabel?: string
}) {
  const [query, setQuery] = useState("")
  const markedDownCount = useMemo(
    () => options.filter((option) => option.markedDown).length,
    [options]
  )
  const [onlyMarkedDown, setOnlyMarkedDown] = useState(markedDownOnly)
  const filtering = onlyMarkedDown && markedDownCount > 0
  const pool = useMemo(
    () => (filtering ? options.filter((option) => option.markedDown) : options),
    [options, filtering]
  )
  // Every match: the list scrolls, so nothing past an arbitrary cap is lost.
  const results = useMemo(
    () => pool.filter((option) => matchesQuery(option.searchText, query)),
    [pool, query]
  )
  return (
    <>
      <div className="border-b border-mad-black/15 p-2">
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Colour, brand or type of ${label}`}
          aria-label={`Search ${label}s`}
          className="h-9 w-full border-2 border-mad-black px-2 text-sm"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] text-mad-black/55">
            {results.length === pool.length
              ? `${pool.length} ${filtering ? filterLabel.toLowerCase() : "that fit here"}`
              : `${results.length} of ${pool.length} match`}
          </p>
          {markedDownCount > 0 ? (
            <button
              type="button"
              aria-pressed={filtering}
              title={
                filtering
                  ? `Showing ${filterLabel.toLowerCase()} pieces only. Click to show all stock.`
                  : `Show only the ${markedDownCount} ${filterLabel.toLowerCase()} pieces`
              }
              onClick={() => setOnlyMarkedDown((value) => !value)}
              className={
                filtering
                  ? "flex h-6 items-center gap-1 border-2 border-mad-black bg-mad-black px-1.5 text-[11px] text-mad-white"
                  : "flex h-6 items-center gap-1 border-2 border-mad-black bg-white px-1.5 text-[11px] hover:bg-[#F4EFE6]"
              }
            >
              <Tag className="size-3" aria-hidden />
              {filterLabel}
            </button>
          ) : null}
        </div>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {results.length === 0 ? (
          <li className="px-3 py-4 text-sm text-mad-black/60">Nothing matches. Try another word.</li>
        ) : (
          results.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(option.id)
                  setQuery("")
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-[#F4EFE6]"
              >
                <span className="h-12 w-10 shrink-0 overflow-hidden bg-neutral-100">
                  {option.thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={option.thumb} alt="" className="size-full object-contain" loading="lazy" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">{option.brand}</span>
                  <span className="block truncate text-[11px] text-mad-black/65">{option.title}</span>
                  <span className="block truncate text-[11px] text-mad-black/50">{option.detail}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  )
}
