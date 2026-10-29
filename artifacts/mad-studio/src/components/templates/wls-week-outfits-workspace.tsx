"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  ArrowRight,
  BringToFront,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Repeat2,
  RotateCcw,
  Scissors,
  SendToBack,
  Shuffle,
  Undo2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { isAdjusted, NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import { OutfitCoverSlide, OutfitSlide, type SlidePiece } from "@/components/templates/outfit-slides"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
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
  swapCandidates,
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

type CoverText = {
  kicker: string
  title: string
  /** null = the week's dates. */
  dateLine: string | null
}

/** Starting points for the cover; every word stays editable. */
const COVER_PICKS: Array<{ label: string; value: CoverText }> = [
  { label: "A week of outfits", value: { kicker: "A week of", title: "Outfits", dateLine: null } },
  { label: "Capsule wardrobe", value: { kicker: "This week's", title: "Capsule Wardrobe", dateLine: null } },
  { label: "For the kids", value: { kicker: "Something for", title: "The Kids", dateLine: null } },
  { label: "Weekend edit", value: { kicker: "Your", title: "Weekend Edit", dateLine: null } },
  { label: "Little ones", value: { kicker: "Something for", title: "The Little Ones", dateLine: null } },
]

type Audience = "women" | "men" | "kids" | "tween" | "baby"

const AUDIENCES: Array<{ id: Audience; label: string }> = [
  { id: "men", label: "Mens" },
  { id: "women", label: "Womens" },
  { id: "kids", label: "Kids" },
  { id: "tween", label: "Tween" },
  { id: "baby", label: "Baby" },
]

/** Children's weeks start from a matching cover pick. */
const AUDIENCE_COVER: Partial<Record<Audience, string>> = {
  kids: "For the kids",
  tween: "For the kids",
  baby: "Little ones",
}

function readAudience(entityId: string): Audience | null {
  try {
    const value = window.localStorage.getItem(`mad.weekAudience.${entityId}`)
    return AUDIENCES.some((option) => option.id === value) ? (value as Audience) : null
  } catch {
    return null
  }
}

function readCover(entityId: string): CoverText | null {
  try {
    const raw = window.localStorage.getItem(`mad.weekCover.${entityId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CoverText>
    if (typeof parsed.title !== "string") return null
    return {
      kicker: typeof parsed.kicker === "string" ? parsed.kicker : "",
      title: parsed.title,
      dateLine: typeof parsed.dateLine === "string" ? parsed.dateLine : null,
    }
  } catch {
    return null
  }
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
  // Hand placements per day (slide index - 1), keyed by piece id.
  const [adjusts, setAdjusts] = useState<Record<number, Record<string, LayerAdjust>>>({})
  const [selected, setSelected] = useState<{ day: number; pieceId: string } | null>(null)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  const range = useMemo(() => nextWeekRange(), [])
  const [cover, setCover] = useState<CoverText>(() => readCover(entityId) ?? COVER_PICKS[0].value)
  const dateLine = cover.dateLine ?? formatWeekRange(range)

  useEffect(() => {
    try {
      window.localStorage.setItem(`mad.weekCover.${entityId}`, JSON.stringify(cover))
    } catch {
      /* the cover words just aren't remembered */
    }
  }, [entityId, cover])

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

  const allPieces = useMemo(() => eligible.map(toOutfitPiece), [eligible])
  const counts = useMemo(() => {
    const out: Record<Audience, number> = { women: 0, men: 0, kids: 0, tween: 0, baby: 0 }
    for (const piece of allPieces) if (piece.gender && piece.gender in out) out[piece.gender as Audience]++
    return out
  }, [allPieces])
  // Until chosen, start with whichever group has the most stock.
  const [audience, setAudience] = useState<Audience | null>(() => readAudience(entityId))
  const activeAudience: Audience =
    audience ?? (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Audience) ?? "women"
  // One group per week (plus unisex), so men's, women's and kids' never mix.
  const pieces = useMemo(
    () => allPieces.filter((piece) => piece.gender === activeAudience || piece.gender === "unisex"),
    [allPieces, activeAudience]
  )
  const ungendered = allPieces.filter((piece) => !piece.gender).length
  const pieceById = useMemo(() => new Map(allPieces.map((piece) => [piece.id, piece])), [allPieces])

  function chooseAudience(next: Audience) {
    if (next === activeAudience) return
    setAudience(next)
    try {
      window.localStorage.setItem(`mad.weekAudience.${entityId}`, next)
    } catch {
      /* remembered for this visit only */
    }
    setWeek(null)
    setAdjusts({})
    setSelected(null)
    // Children's weeks get a matching cover; a cover you typed yourself is kept.
    const isPick = COVER_PICKS.some((pick) => pick.value.title === cover.title && pick.value.kicker === cover.kicker)
    if (isPick) {
      const label = AUDIENCE_COVER[next] ?? "A week of outfits"
      setCover((COVER_PICKS.find((pick) => pick.label === label) ?? COVER_PICKS[0]).value)
    }
  }

  useEffect(() => {
    if (loaded && !loading && week === null && pieces.length > 0) {
      setWeek(buildWeekOutfits(pieces))
    }
  }, [loaded, loading, week, pieces])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

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

  /** Stock that could take this piece's place, for the search panel. */
  function pickerOptions(dayIndex: number, pieceId: string): PickerOption[] {
    if (!week) return []
    return swapCandidates({ pieces, outfit: week[dayIndex].pieceIds, currentId: pieceId }).flatMap((piece) => {
      const story = stories.get(piece.id)
      if (!story) return []
      const row = story.row
      const image = story.cutoutUrl ?? row.sourceImageUrls[0] ?? null
      return [
        {
          id: piece.id,
          brand: story.designer,
          title: row.title,
          detail: [formatSizeForText(row.size), shortPrice(story.priceLabel), row.vibe].filter(Boolean).join(" · "),
          thumb: image ? proxiedImageUrl(image, entityId) : null,
          searchText: [row.title, row.brand, row.description, row.category, row.vibe, row.size].filter(Boolean).join(" "),
        },
      ]
    })
  }

  function setAdjust(day: number, pieceId: string, next: LayerAdjust | null) {
    setAdjusts((current) => {
      const dayAdjusts = { ...current[day] }
      if (next) dayAdjusts[pieceId] = next
      else delete dayAdjusts[pieceId]
      return { ...current, [day]: dayAdjusts }
    })
  }

  /** Bring the selected piece to the front (+1) or send it to the back (-1). */
  function restack(direction: 1 | -1) {
    if (!selected || !week) return
    const ids = week[selected.day].pieceIds
    const current = adjusts[selected.day] ?? {}
    const levels = ids.map((id) => current[id]?.z ?? 0)
    const z = direction === 1 ? Math.max(...levels, 5) + 1 : Math.min(...levels, 0) - 1
    setAdjust(selected.day, selected.pieceId, {
      ...(current[selected.pieceId] ?? NO_ADJUST),
      z,
    })
  }

  function buildCaption(): string {
    const lines = (week ?? []).map((day) => {
      const parts = day.pieceIds.flatMap((id) => {
        const story = stories.get(id)
        const piece = pieceById.get(id)
        if (!story || !piece) return []
        // "AU 8 | EU 36 | US 4" reads as "Size 8" in a caption.
        const size = formatSizeForText(story.row.size)
        const details = [size, shortPrice(story.priceLabel)].filter(Boolean).join(", ")
        return [`${pieceName(story, OUTFIT_SLOT_LABELS[piece.slot])}${details ? ` (${details})` : ""}`]
      })
      return `${day.day}: ${parts.join(" + ")}`
    })
    const heading = [cover.kicker.trim(), cover.title.trim()].filter(Boolean).join(" ")
    const opener = heading ? heading.charAt(0).toUpperCase() + heading.slice(1).toLowerCase() : "A week of outfits"
    return [
      `${opener}, every piece on our racks right now.`,
      "",
      ...lines,
      "",
      "Shop through the link in our bio, or come try them on in store.",
    ].join("\n")
  }

  async function sendToStudio() {
    if (!week) return
    setSelected(null)
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


  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Monday carousel · {formatWeekRange(range)} · 8 slides, 4:5
          </p>
          <h1 className="brand-typewriter text-xl">A week of outfits</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Seven outfits built from what&apos;s on the racks. Drag any piece to
            move it, pull its corner to resize or its top dot to tilt. Then
            send the slides to Studio to write the caption and schedule.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex border-2 border-mad-black" role="group" aria-label="Who this week is for">
            {AUDIENCES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseAudience(option.id)}
                aria-pressed={option.id === activeAudience}
                className={cn(
                  "flex h-9 items-center gap-1.5 px-3 font-typewriter text-xs font-bold uppercase tracking-widest",
                  option.id === activeAudience ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                )}
              >
                {option.label}
                <span className={cn("text-[10px] font-normal", option.id === activeAudience ? "text-mad-white/70" : "text-mad-black/50")}>
                  {counts[option.id]}
                </span>
              </button>
            ))}
          </div>
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
              setAdjusts({})
              setSelected(null)
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
        <p className="text-sm text-mad-black/60">
          {allPieces.length === 0
            ? "No live stock to build outfits from yet."
            : `No ${AUDIENCES.find((option) => option.id === activeAudience)?.label.toLowerCase()} pieces in stock right now.`}
        </p>
      ) : (
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex min-w-0 flex-col gap-2">
            <OutfitCoverSlide
              ref={(node) => {
                slideNodes.current[0] = node
              }}
              background={background}
              brandName={entityName}
              kicker={cover.kicker}
              title={cover.title}
              dateRange={dateLine}
              className="rounded-sm shadow-md"
            />
            <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">Slide 1 · Cover</p>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Cover quick picks">
              {COVER_PICKS.map((pick) => (
                <button
                  key={pick.label}
                  type="button"
                  onClick={() => setCover(pick.value)}
                  aria-pressed={cover.title === pick.value.title && cover.kicker === pick.value.kicker}
                  className={cn(
                    "border px-2 py-0.5 text-[11px]",
                    cover.title === pick.value.title && cover.kicker === pick.value.kicker
                      ? "border-mad-black bg-mad-black text-mad-white"
                      : "border-mad-black/30 hover:border-mad-black"
                  )}
                >
                  {pick.label}
                </button>
              ))}
            </div>
            <label className="grid gap-0.5 text-[11px]">
              <span className="text-mad-black/60">Small line</span>
              <input
                id="cover-kicker"
                value={cover.kicker}
                maxLength={30}
                onChange={(event) => setCover((current) => ({ ...current, kicker: event.target.value }))}
                className="h-8 border-2 border-mad-black/40 bg-white px-2 text-xs uppercase tracking-wider"
              />
            </label>
            <label className="grid gap-0.5 text-[11px]">
              <span className="text-mad-black/60">Title</span>
              <input
                id="cover-title"
                value={cover.title}
                maxLength={30}
                onChange={(event) => setCover((current) => ({ ...current, title: event.target.value }))}
                className="h-8 border-2 border-mad-black bg-white px-2 text-xs font-semibold uppercase tracking-wider"
              />
            </label>
            <label className="grid gap-0.5 text-[11px]">
              <span className="flex items-center justify-between text-mad-black/60">
                Line under the title
                {cover.dateLine !== null ? (
                  <button
                    type="button"
                    onClick={() => setCover((current) => ({ ...current, dateLine: null }))}
                    className="underline"
                  >
                    Use the dates
                  </button>
                ) : null}
              </span>
              <input
                id="cover-date-line"
                value={dateLine}
                maxLength={40}
                placeholder="Leave empty to hide"
                onChange={(event) => setCover((current) => ({ ...current, dateLine: event.target.value }))}
                className="h-8 border-2 border-mad-black/40 bg-white px-2 text-xs uppercase tracking-wider"
              />
            </label>
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
                  adjust={adjusts[index]}
                  onAdjust={(pieceId, next) => setAdjust(index, pieceId, next)}
                  selectedId={selected?.day === index ? selected.pieceId : null}
                  onSelect={(pieceId) => setSelected(pieceId ? { day: index, pieceId } : null)}
                  className="rounded-sm shadow-md"
                />
                <div className="flex min-h-7 items-center justify-between gap-2">
                  <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">
                    Slide {index + 2} · {day.day}
                  </p>
                  <div className="flex items-center gap-0.5">
                    {selected?.day === index ? (
                      <>
                        <button
                          type="button"
                          onClick={() => restack(1)}
                          title="Bring to front"
                          aria-label="Bring the selected piece to the front"
                          className="flex size-7 items-center justify-center text-mad-black/70 hover:text-mad-black"
                        >
                          <BringToFront className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => restack(-1)}
                          title="Send to back"
                          aria-label="Send the selected piece to the back"
                          className="flex size-7 items-center justify-center text-mad-black/70 hover:text-mad-black"
                        >
                          <SendToBack className="size-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjust(index, selected.pieceId, null)}
                          disabled={!isAdjusted(adjusts[index]?.[selected.pieceId])}
                          title="Put this piece back"
                          aria-label="Put the selected piece back in its automatic spot"
                          className="flex size-7 items-center justify-center text-mad-black/70 hover:text-mad-black disabled:opacity-30"
                        >
                          <RotateCcw className="size-4" aria-hidden />
                        </button>
                      </>
                    ) : null}
                    {Object.keys(adjusts[index] ?? {}).length > 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAdjusts((current) => ({ ...current, [index]: {} }))
                          setSelected(null)
                        }}
                        title="Reset this slide's layout"
                        aria-label={`Reset ${day.day}'s layout`}
                        className="flex size-7 items-center justify-center text-mad-black/70 hover:text-mad-black"
                      >
                        <Undo2 className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>
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
                          {formatSizeForText(story.row.size) ? ` · ${formatSizeForText(story.row.size)}` : ""}
                        </span>
                        {cuttingId === id ? <Scissors className="size-3 animate-pulse text-mad-black/50" aria-hidden /> : null}
                        <PiecePicker
                          label={OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}
                          options={pickerOptions(index, id)}
                          onPick={(next) => updateDay(index, day.pieceIds.map((pieceId) => (pieceId === id ? next : pieceId)))}
                        />
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
          Built from {pieces.length} {AUDIENCES.find((option) => option.id === activeAudience)?.label.toLowerCase()} pieces in stock
          {ungendered > 0 ? ` (${ungendered} without a men's, women's or kids' tag are left out)` : ""}. Rebuild after new arrivals land.
        </p>
      ) : null}
    </div>
  )
}
