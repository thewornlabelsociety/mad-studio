"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

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
}

/** Search the stock that fits this spot, by colour, brand or type, and pick one. */
export function PiecePicker({
  label,
  options,
  onPick,
}: {
  /** e.g. "top", for the button's name and the search placeholder. */
  label: string
  options: PickerOption[]
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const results = useMemo(
    () => options.filter((option) => matchesQuery(option.searchText, query)).slice(0, 40),
    [options, query]
  )

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Search for a ${label}`}
          aria-label={`Search for a different ${label}`}
          className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
        >
          <Search className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-none border-2 border-mad-black p-0">
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
          <p className="mt-1 text-[11px] text-mad-black/55">
            {results.length === options.length
              ? `${options.length} that fit here`
              : `${results.length} of ${options.length} match`}
          </p>
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
                    setOpen(false)
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
      </PopoverContent>
    </Popover>
  )
}
