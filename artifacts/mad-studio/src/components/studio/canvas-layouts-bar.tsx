"use client"

import { useEffect, useState, type ReactNode } from "react"
import { LayoutTemplate, Loader2, Star, Trash2 } from "lucide-react"

import type {
  LayoutWordingMode,
  SavedCanvasLayout,
} from "@/lib/studio/canvas-layouts"
import { cn } from "@/lib/utils"

type Props = {
  layouts: SavedCanvasLayout[]
  photoCount: number
  busy?: boolean
  /** Save control (dialog) — receives the layout selected in the dropdown. */
  saveSlot?: ReactNode | ((selected: SavedCanvasLayout | null) => ReactNode)
  onApply: (
    layoutId: string,
    scope: "slide" | "all",
    wording: LayoutWordingMode
  ) => void
  onSetDefault: (layoutId: string | null) => void
  onDelete: (layoutId: string) => void
  className?: string
}

const btn =
  "inline-flex h-9 items-center gap-1.5 border-2 border-mad-black px-2.5 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase disabled:opacity-40"

/**
 * Saved layouts on the Canvas step: save, pick one, apply, set default, delete.
 */
export function CanvasLayoutsBar({
  layouts,
  photoCount,
  busy = false,
  saveSlot = null,
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

  const selected = layouts.find((row) => row.id === selectedId) ?? null

  if (layouts.length === 0) {
    return (
      <section
        aria-label="Saved layouts"
        className={cn(
          "shrink-0 space-y-1.5 border border-mad-black/20 bg-mad-white p-2.5",
          className
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            <LayoutTemplate className="size-4" aria-hidden />
            Saved looks
          </p>
          {typeof saveSlot === "function" ? saveSlot(null) : saveSlot}
        </div>
        <p className="text-xs text-neutral-600">
          Style this picture, then save it to reuse the look.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-label="Saved layouts"
      className={cn(
        "shrink-0 border border-mad-black/20 bg-mad-white p-2",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
          <LayoutTemplate className="size-4" aria-hidden />
          Look
        </span>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          aria-label="Saved layout"
          className="h-9 min-w-[10rem] flex-1 border-2 border-mad-black bg-mad-white px-2 text-sm sm:max-w-xs"
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
          onClick={() => selected && onApply(selected.id, "slide", "keep-slide")}
          title="Use this look on this picture (keeps your words)"
          className={cn(btn, "bg-mad-black text-mad-white hover:bg-mad-vermillion")}
        >
          Use
        </button>
        {photoCount > 1 ? (
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => selected && onApply(selected.id, "all", "keep-slide")}
            title="Use this look on every picture"
            className={cn(btn, "bg-mad-white hover:bg-mad-lime")}
          >
            All {photoCount}
          </button>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1.5">
        {typeof saveSlot === "function" ? saveSlot(selected) : saveSlot}
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() =>
            selected && onSetDefault(selected.isDefault ? null : selected.id)
          }
          title={
            selected?.isDefault
              ? "Default for new posts — click to unset"
              : "Use this layout for every new post"
          }
          aria-label={
            selected?.isDefault
              ? "Unset default layout"
              : "Make this the default layout"
          }
          aria-pressed={Boolean(selected?.isDefault)}
          className={cn(
            btn,
            "px-2",
            selected?.isDefault
              ? "bg-mad-lime"
              : "bg-mad-white hover:bg-mad-lime"
          )}
        >
          <Star
            className={cn("size-3.5", selected?.isDefault && "fill-current")}
            aria-hidden
          />
        </button>
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => selected && onDelete(selected.id)}
          title="Delete this layout"
          aria-label="Delete this layout"
          className={cn(
            btn,
            "bg-mad-white px-2 hover:bg-mad-vermillion hover:text-mad-white"
          )}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
        {busy ? (
          <Loader2
            className="size-4 animate-spin text-neutral-500"
            aria-label="Saving"
          />
        ) : null}
        </span>
      </div>
    </section>
  )
}
