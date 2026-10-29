"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  ArrowRight,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Repeat2,
  Scissors,
  Shuffle,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { OutfitCoverSlide, OutfitSlide, type SlidePiece } from "@/components/templates/outfit-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import {
  saveStudioSlidesHandoff,
  STUDIO_SLIDES_QUERY_FLAG,
} from "@/lib/studio/studio-slides-handoff"
import { bakeStoryPng, useKitStories, type KitStory } from "@/lib/templates/use-kit-stories"
import {
  addableSlots,
  addPiece,
  buildWeekOutfits,
  formatWeekRange,
  nextSwap,
  nextWeekRange,
  OUTFIT_SLOT_LABELS,
  toOutfitPiece,
  type DayOutfit,
} from "@/lib/templates/week-outfits"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

function shortPrice(label: string | null | undefined): string | null {
  if (!label || label === "—") return null
  return label.replace(/\.00$/, "")
}

function pieceName(story: KitStory, slot: string): string {
  return `${story.designer} ${slot.toLowerCase()}`
}

/** Monday's carousel: a cover and seven outfits from live stock, ready for Studio. */
export function WlsWeekOutfitsWorkspace({
  entityId,
  entityName,
  industry = null,
  brandIdentity = null,
}: Props) {
  const [, navigate] = useLocation()
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const [week, setWeek] = useState<DayOutfit[] | null>(null)
  const [backgroundId, setBackgroundId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const range = useMemo(() => nextWeekRange(), [])

  const weekIds = useMemo(() => [...new Set((week ?? []).flatMap((day) => day.pieceIds))], [week])
  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed, retryCutout } =
    useKitStories({
      entityId,
      entityName,
      industry,
      brandIdentity,
      isWornLabel: isWls,
      cutoutIds: weekIds,
    })

  const pieces = useMemo(() => eligible.map(toOutfitPiece), [eligible])
  const pieceById = useMemo(() => new Map(pieces.map((piece) => [piece.id, piece])), [pieces])

  useEffect(() => {
    if (loaded && !loading && week === null && pieces.length > 0) {
      setWeek(buildWeekOutfits(pieces))
    }
  }, [loaded, loading, week, pieces])

  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const waiting = weekIds.filter((id) => !stories.get(id)?.cutoutUrl && !cutoutFailed[id])
  const failed = weekIds.filter((id) => cutoutFailed[id] && !stories.get(id)?.cutoutUrl)

  function slidePieces(day: DayOutfit): SlidePiece[] {
    return day.pieceIds.flatMap((id) => {
      const story = stories.get(id)
      const piece = pieceById.get(id)
      if (!story || !piece) return []
      return [
        {
          id,
          slot: piece.slot,
          imageUrl: story.cutoutUrl ? story.imageUrl : null,
          brand: story.designer,
          sizeLabel: story.sizeLabel,
          priceLabel: shortPrice(story.priceLabel),
        },
      ]
    })
  }

  function dayVibe(day: DayOutfit): string | null {
    const anchor = day.pieceIds
      .map((id) => pieceById.get(id))
      .find((piece) => piece?.slot === "top" || piece?.slot === "dress")
    return anchor?.vibe ?? null
  }

  function updateDay(index: number, pieceIds: string[]) {
    setWeek((current) =>
      current ? current.map((day, i) => (i === index ? { ...day, pieceIds } : day)) : current
    )
  }

  function swap(index: number, pieceId: string) {
    if (!week) return
    const next = nextSwap({ pieces, outfit: week[index].pieceIds, currentId: pieceId })
    if (!next) {
      toast.message("Nothing else in stock fits there.")
      return
    }
    updateDay(index, week[index].pieceIds.map((id) => (id === pieceId ? next : id)))
  }

  function buildCaption(): string {
    const lines = (week ?? []).map((day) => {
      const parts = day.pieceIds.flatMap((id) => {
        const story = stories.get(id)
        const piece = pieceById.get(id)
        if (!story || !piece) return []
        // "AU 8 | EU 36 | US 4" reads as "AU 8" in a caption.
        const size = story.row.size?.split(/[|·/]/)[0]?.trim() || null
        const details = [size, shortPrice(story.priceLabel)].filter(Boolean).join(", ")
        return [`${pieceName(story, OUTFIT_SLOT_LABELS[piece.slot])}${details ? ` (${details})` : ""}`]
      })
      return `${day.day}: ${parts.join(" + ")}`
    })
    return [
      "A week of outfits, every piece on our racks right now.",
      "",
      ...lines,
      "",
      "Shop through the link in our bio, or come try them on in store.",
    ].join("\n")
  }

  async function sendToStudio() {
    if (!week) return
    setSending(true)
    try {
      const urls: string[] = []
      for (const node of slideNodes.current) {
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length < 2) throw new Error("The slides aren't ready yet.")
      saveStudioSlidesHandoff(entityId, { urls, caption: buildCaption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the slides.")
      setSending(false)
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        The week of outfits is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  const coverImages = (week ?? []).flatMap((day) => {
    const id = day.pieceIds.find((pieceId) => {
      const slot = pieceById.get(pieceId)?.slot
      return slot === "top" || slot === "dress"
    })
    const story = id ? stories.get(id) : null
    return story?.cutoutUrl && story.imageUrl ? [story.imageUrl] : []
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Monday carousel · {formatWeekRange(range)} · 8 slides, 4:5
          </p>
          <h1 className="brand-typewriter text-xl">A week of outfits</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Seven outfits built from what&apos;s on the racks. Swap any piece,
            then send the slides to Studio to write the caption and schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Background for the week">
            {kit.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackgroundId(bg.id)}
                title={bg.name}
                aria-label={`Use ${bg.name} all week`}
                aria-pressed={bg.id === background.id}
                className={cn(
                  "relative size-8 rounded-full border border-black/15",
                  bg.id === background.id && "ring-2 ring-mad-black ring-offset-2"
                )}
                style={{ background: bg.color }}
              >
                {bg.id === background.id ? (
                  <Check className="absolute inset-0 m-auto size-3.5" style={{ color: bg.text_color }} aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={loading || sending}
            onClick={() => {
              setWeek(null)
              void reload()
            }}
            title="Rebuild the week from current stock"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Shuffle className="mr-2 size-4" />}
            Rebuild week
          </Button>
          <Button
            type="button"
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={!week || waiting.length > 0 || sending}
            onClick={() => void sendToStudio()}
            title={waiting.length > 0 ? "Waiting for cutouts" : "Open these slides in Studio"}
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slides…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      {waiting.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-mad-black/65">
          <Scissors className="size-3.5" aria-hidden />
          Cutting out {waiting.length} piece{waiting.length === 1 ? "" : "s"}
          {cuttingId ? "…" : ""}
        </p>
      ) : null}
      {failed.length > 0 ? (
        <p className="flex flex-wrap items-center gap-2 border-2 border-mad-vermillion bg-mad-vermillion/10 px-3 py-2 text-xs">
          {failed.length} piece{failed.length === 1 ? "" : "s"} couldn&apos;t be cut out and are left off the slides.
          <button type="button" className="underline" onClick={() => failed.forEach(retryCutout)}>
            Try again
          </button>
        </p>
      ) : null}

      {!loaded || (loading && !week) ? (
        <p className="flex items-center gap-2 text-sm text-mad-black/60">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Building the week from stock…
        </p>
      ) : !week || pieces.length === 0 ? (
        <p className="text-sm text-mad-black/60">No live stock to build outfits from yet.</p>
      ) : (
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex min-w-0 flex-col gap-2">
            <OutfitCoverSlide
              ref={(node) => {
                slideNodes.current[0] = node
              }}
              background={background}
              brandName={entityName}
              dateRange={formatWeekRange(range)}
              imageUrls={coverImages}
              className="rounded-sm shadow-md"
            />
            <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">Slide 1 · Cover</p>
          </li>
          {week.map((day, index) => {
            const options = addableSlots({ pieces, outfit: day.pieceIds })
            return (
              <li key={day.day} className="flex min-w-0 flex-col gap-2">
                <OutfitSlide
                  ref={(node) => {
                    slideNodes.current[index + 1] = node
                  }}
                  background={background}
                  brandName={entityName}
                  day={day.day}
                  vibe={dayVibe(day)}
                  pieces={slidePieces(day)}
                  className="rounded-sm shadow-md"
                />
                <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">
                  Slide {index + 2} · {day.day}
                </p>
                <ul className="grid grid-cols-1 gap-1">
                  {day.pieceIds.map((id) => {
                    const story = stories.get(id)
                    const piece = pieceById.get(id)
                    if (!story || !piece) return null
                    return (
                      <li key={id} className="flex items-center gap-2 border border-mad-black/15 bg-white px-2 py-1">
                        <span className="w-16 shrink-0 font-typewriter text-[10px] uppercase text-mad-black/55">
                          {OUTFIT_SLOT_LABELS[piece.slot]}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs" title={story.row.title}>
                          {story.designer}
                          {story.row.size ? ` · ${story.row.size}` : ""}
                        </span>
                        {cuttingId === id ? <Scissors className="size-3 animate-pulse text-mad-black/50" aria-hidden /> : null}
                        <button
                          type="button"
                          onClick={() => swap(index, id)}
                          title="Swap for another piece"
                          aria-label={`Swap ${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}`}
                          className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
                        >
                          <Repeat2 className="size-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateDay(index, day.pieceIds.filter((pieceId) => pieceId !== id))}
                          disabled={day.pieceIds.length <= 1}
                          title="Take this piece out"
                          aria-label={`Remove ${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}`}
                          className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black disabled:opacity-30"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {options.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => updateDay(index, addPiece({ pieces, outfit: day.pieceIds, slot }))}
                        className="flex items-center gap-1 border border-dashed border-mad-black/40 px-2 py-0.5 text-[11px] text-mad-black/70 hover:border-mad-black hover:text-mad-black"
                      >
                        <Plus className="size-3" aria-hidden /> {OUTFIT_SLOT_LABELS[slot]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
      {loaded && week ? (
        <p className="flex items-center gap-2 pb-4 text-xs text-mad-black/55">
          <RefreshCw className="size-3" aria-hidden />
          Built from {pieces.length} pieces in stock. Rebuild after new arrivals land.
        </p>
      ) : null}
    </div>
  )
}
