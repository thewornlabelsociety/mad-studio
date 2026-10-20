"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Film,
  GalleryHorizontal,
  ImageIcon,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import {
  fetchNewArrivalSuggestions,
  setArrivalUsed,
  SUGGESTED_FORMAT_LABELS,
  type NewArrivalSuggestion,
  type SuggestedFormat,
} from "@/lib/studio/new-arrival-suggestions"
import { cn } from "@/lib/utils"

const FORMAT_ICONS: Record<SuggestedFormat, typeof Film> = {
  carousel: GalleryHorizontal,
  reel: Film,
  story: Link2,
  single: ImageIcon,
}

type Props = {
  entityId: string
  isFashion: boolean
  /** Loads the arrival; returns what to say and how to take it back out. */
  onUse: (
    suggestion: NewArrivalSuggestion
  ) => { title: string; undo: () => void } | null
  /** Item currently loaded in the tray, highlighted. */
  activeItemId?: string | null
  disabled?: boolean
  className?: string
}

/** Unposted new arrivals, each with the format that suits it best. */
export function NewArrivalSuggestions({
  entityId,
  isFashion,
  onUse,
  activeItemId = null,
  disabled = false,
  className,
}: Props) {
  const [rows, setRows] = useState<NewArrivalSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchNewArrivalSuggestions({ entityId, isFashion, limit: 24 }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load new arrivals.")
    } finally {
      setLoading(false)
    }
  }, [entityId, isFashion])

  useEffect(() => {
    void load()
  }, [load])

  // Refresh checks the website for new stock first (Worn Label), then
  // reloads the list.
  const [pulling, setPulling] = useState(false)
  async function refresh() {
    if (isFashion) {
      setPulling(true)
      try {
        const response = await fetch("/api/sync/pull-new-arrivals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityId }),
        })
        const payload = (await response.json().catch(() => ({}))) as {
          imported?: number
          error?: string
        }
        if (!response.ok) {
          throw new Error(payload.error ?? "Couldn't check the website for new stock.")
        }
        toast.success(
          payload.imported
            ? `${payload.imported} new arrival${payload.imported === 1 ? "" : "s"} pulled from the website`
            : "Up to date — no new arrivals on the website"
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't check the website.")
      } finally {
        setPulling(false)
      }
    }
    await load()
  }

  // Using an arrival takes it off this list for good (it stays in the media
  // library); Undo puts it back.
  function use(row: NewArrivalSuggestion) {
    const result = onUse(row)
    if (!result) return
    setRows((current) => current.filter((r) => r.item.id !== row.item.id))
    void setArrivalUsed({ entityId, itemId: row.item.id, used: true })
    toast.success(result.title, {
      description: "Removed from suggestions — still in your media library.",
      action: {
        label: "Undo",
        onClick: () => {
          result.undo()
          setRows((current) =>
            current.some((r) => r.item.id === row.item.id)
              ? current
              : [row, ...current]
          )
          void setArrivalUsed({ entityId, itemId: row.item.id, used: false })
        },
      },
    })
  }

  return (
    <section
      aria-label="New arrivals to post"
      className={cn("mt-5 space-y-3", className)}
    >
      <div className="flex items-end justify-between gap-2 border-b-2 border-mad-black/10 pb-1.5">
        <div>
          <p className="font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Suggested · new arrivals
          </p>
          <p className="text-xs text-neutral-600">
            Not posted yet. Pick one and we&apos;ll set up the format that suits it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || pulling}
          title={isFashion ? "Check the website for new arrivals" : "Refresh"}
          aria-label={isFashion ? "Check the website for new arrivals" : "Refresh new arrivals"}
          className="inline-flex size-8 shrink-0 items-center justify-center border-2 border-mad-black hover:bg-mad-lime disabled:opacity-50"
        >
          {loading || pulling ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
        </button>
      </div>

      {error ? (
        <p className="text-xs text-mad-vermillion">{error}</p>
      ) : !loading && rows.length === 0 ? (
        <p className="border-2 border-dashed border-mad-black/30 px-3 py-4 text-center text-xs text-neutral-600">
          All caught up — no unposted arrivals. Pull new arrivals from Today or
          Library when stock comes in.
        </p>
      ) : (
        <ul className="flex snap-x gap-3 overflow-x-auto pb-2">
          {rows.map((row) => {
            const Icon = FORMAT_ICONS[row.format]
            const active = row.item.id === activeItemId
            const cover = row.media.find((m) => m.kind === "image") ?? row.media[0]
            const facts = [row.facts.brand, row.facts.size, row.facts.price]
              .filter(Boolean)
              .join(" · ")
            return (
              <li
                key={row.item.id}
                className={cn(
                  "flex w-44 shrink-0 snap-start flex-col border-2 border-mad-black bg-mad-white",
                  active && "ring-2 ring-mad-vermillion ring-offset-1"
                )}
              >
                <div className="relative h-36 overflow-hidden bg-neutral-100">
                  {cover.kind === "video" ? (
                    <video
                      src={cover.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : (
                    <img
                      src={cover.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                  <span
                    title={row.reason}
                    className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-1.5 py-0.5 font-typewriter text-[0.68rem] font-bold tracking-wider uppercase"
                  >
                    <Icon className="size-3" aria-hidden />
                    {SUGGESTED_FORMAT_LABELS[row.format]}
                  </span>
                  {row.media.length > 1 ? (
                    <span className="absolute right-1.5 bottom-1.5 bg-mad-black/75 px-1.5 py-0.5 font-typewriter text-[0.68rem] font-bold text-mad-white">
                      {row.media.length}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2">
                  <p className="line-clamp-1 text-xs font-semibold text-mad-black">
                    {row.item.title}
                  </p>
                  {facts ? (
                    <p className="line-clamp-1 text-[0.75rem] text-neutral-600">
                      {facts}
                    </p>
                  ) : null}
                  <p className="line-clamp-2 text-[0.72rem] leading-snug text-neutral-500" title={row.reason}>
                    {row.reason}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => use(row)}
                    className={cn(
                      "mt-auto border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase disabled:opacity-40",
                      active
                        ? "bg-mad-lime text-mad-black"
                        : "bg-mad-black text-mad-white hover:bg-mad-vermillion"
                    )}
                  >
                    {active ? "In use" : `Use as ${SUGGESTED_FORMAT_LABELS[row.format].toLowerCase()}`}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
