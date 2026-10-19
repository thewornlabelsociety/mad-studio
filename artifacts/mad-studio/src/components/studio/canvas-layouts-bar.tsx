"use client"

import { useEffect, useState } from "react"
import { LayoutTemplate, Loader2, Star, Trash2 } from "lucide-react"

import type { SavedCanvasLayout } from "@/lib/studio/canvas-layouts"
import { cn } from "@/lib/utils"

type Props = {
  layouts: SavedCanvasLayout[]
  photoCount: number
  busy?: boolean
  onApply: (layoutId: string, scope: "slide" | "all") => void
  onSetDefault: (layoutId: string | null) => void
  onDelete: (layoutId: string) => void
  className?: string
}

const btn =
  "inline-flex h-9 items-center gap-1.5 border-2 border-mad-black px-2.5 font-typewriter text-[0.55rem] font-bold tracking-wider uppercase disabled:opacity-40"

/**
 * Your saved layouts (saved from the icon beside the live preview): pick one
 * to apply, set the default for new posts, or remove it.
 */
export function CanvasLayoutsBar({
  layouts,
  photoCount,
  busy = false,
  onApply,
  onSetDefault,
  onDelete,
  className,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>("")

  // Keep a valid selection (prefer the default layout).
  useEffect(() => {
    if (layouts.some((row) => row.id === selectedId)) return
    setSelectedId(layouts.find((row) => row.isDefault)?.id ?? layouts[0]?.id ?? "")
  }, [layouts, selectedId])

  if (layouts.length === 0) return null
  const selected = layouts.find((row) => row.id === selectedId) ?? null

  return (
    <section
      aria-label="Saved layouts"
      className={cn(
        "flex flex-wrap items-center gap-2 border-2 border-mad-black bg-mad-white p-2",
        className
      )}
    >
      <span className="inline-flex items-center gap-1.5 font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
        <LayoutTemplate className="size-4" aria-hidden />
        Layouts
      </span>
      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        aria-label="Saved layout"
        className="h-9 w-48 min-w-[9rem] max-w-full border-2 border-mad-black bg-mad-white px-2 text-sm"
      >
        {layouts.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
            {row.isDefault ? " (default)" : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => selected && onApply(selected.id, "slide")}
        className={cn(btn, "bg-mad-black text-mad-white hover:bg-mad-vermillion")}
      >
        Apply
      </button>
      {photoCount > 1 ? (
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => selected && onApply(selected.id, "all")}
          className={cn(btn, "bg-mad-white hover:bg-mad-lime")}
        >
          Apply to all {photoCount}
        </button>
      ) : null}
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => selected && onSetDefault(selected.isDefault ? null : selected.id)}
        title={
          selected?.isDefault
            ? "Default for new posts — click to unset"
            : "Use this layout for every new post"
        }
        aria-label={selected?.isDefault ? "Unset default layout" : "Make this the default layout"}
        aria-pressed={Boolean(selected?.isDefault)}
        className={cn(btn, "px-2", selected?.isDefault ? "bg-mad-lime" : "bg-mad-white hover:bg-mad-lime")}
      >
        <Star className={cn("size-3.5", selected?.isDefault && "fill-current")} aria-hidden />
      </button>
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => selected && onDelete(selected.id)}
        title="Delete this layout"
        aria-label="Delete this layout"
        className={cn(btn, "bg-mad-white px-2 hover:bg-mad-vermillion hover:text-mad-white")}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
      {busy ? <Loader2 className="size-4 animate-spin text-neutral-500" aria-label="Saving" /> : null}
    </section>
  )
}
