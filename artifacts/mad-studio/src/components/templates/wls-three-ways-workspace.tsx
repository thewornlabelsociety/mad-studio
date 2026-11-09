"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  ArrowRight,
  BringToFront,
  Check,
  Loader2,
  Lock,
  Plus,
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
import { OutfitSlide, type SlidePiece } from "@/components/templates/outfit-slides"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { ThreeWaysCoverSlide } from "@/components/templates/three-ways-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { pieceType } from "@/lib/templates/story-card-style"
import { buildThreeWays, LOOK_NAME_PICKS } from "@/lib/templates/three-ways"
import { bakeStoryPng, useKitStories, type KitStory } from "@/lib/templates/use-kit-stories"
import {
  addableSlots,
  addPiece,
  nextSwap,
  OUTFIT_SLOT_LABELS,
  swapCandidates,
  toOutfitPiece,
} from "@/lib/templates/week-outfits"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

type CoverText = { kicker: string; title: string }

const DEFAULT_COVER: CoverText = { kicker: "One piece", title: "Three ways" }

function shortPrice(label: string | null | undefined): string | null {
  if (!label || label === "—") return null
  return label.replace(/\.00$/, "")
}

function optionFor(story: KitStory, entityId: string): PickerOption {
  const row = story.row
  const image = story.cutoutUrl ?? row.sourceImageUrls[0] ?? null
  return {
    id: row.marketingEntityId,
    brand: story.designer,
    title: row.title,
    detail: [formatSizeForText(row.size), shortPrice(story.priceLabel), row.vibe].filter(Boolean).join(" · "),
    thumb: image ? proxiedImageUrl(image, entityId) : null,
    searchText: [row.title, row.brand, row.description, row.category, row.vibe, row.size].filter(Boolean).join(" "),
  }
}

/** One piece from the racks styled three ways: a cover with the piece, then three outfits around it. */
export function WlsThreeWaysWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  // Kept as a draft on this device, so leaving the screen keeps the post.
  const draftKey = `mad.threeWays.${entityId}`
  const [heroId, setHeroId] = useRememberedState<string | null>(`${draftKey}.hero`, null)
  const [looks, setLooks] = useRememberedState<string[][] | null>(`${draftKey}.looks`, null)
  const [lookNames, setLookNames] = useRememberedState<string[]>(`${draftKey}.names`, LOOK_NAME_PICKS[0])
  const [cover, setCover] = useRememberedState<CoverText>(`${draftKey}.cover`, DEFAULT_COVER)
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`${draftKey}.background`, null)
  // Hand placements per look, keyed by piece id.
  const [adjusts, setAdjusts] = useRememberedState<Record<number, Record<string, LayerAdjust>>>(`${draftKey}.placements`, {})
  const [selected, setSelected] = useState<{ look: number; pieceId: string } | null>(null)
  const [sending, setSending] = useState(false)

  const lookIds = useMemo(
    () => [...new Set([...(heroId ? [heroId] : []), ...(looks ?? []).flat()])],
    [heroId, looks]
  )
  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed, retryCutout } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: lookIds,
  })

  const allPieces = useMemo(() => eligible.map(toOutfitPiece), [eligible])
  const pieceById = useMemo(() => new Map(allPieces.map((piece) => [piece.id, piece])), [allPieces])
  const hero = heroId ? pieceById.get(heroId) ?? null : null
  const heroStory = heroId ? stories.get(heroId) ?? null : null
  // Men's, women's and kids' never mix: the piece's group plus unisex.
  const pieces = useMemo(() => {
    if (!hero?.gender || hero.gender === "unisex") return allPieces
    return allPieces.filter((piece) => piece.gender === hero.gender || piece.gender === "unisex")
  }, [allPieces, hero])

  useEffect(() => {
    if (loaded && !loading && heroId && looks === null && pieceById.has(heroId)) {
      setLooks(buildThreeWays(pieces, heroId))
    }
  }, [loaded, loading, heroId, looks, pieces, pieceById, setLooks])

  // A kept draft may name pieces that have since sold: drop them, or start over if the piece itself sold.
  useEffect(() => {
    if (!loaded || loading || allPieces.length === 0 || !heroId) return
    if (!pieceById.has(heroId)) {
      toast.message("That piece has sold. Choose another.")
      setHeroId(null)
      setLooks(null)
      setAdjusts({})
      return
    }
    if (!looks || looks.every((look) => look.every((id) => pieceById.has(id)))) return
    setLooks(looks.map((look) => look.filter((id) => pieceById.has(id))))
  }, [loaded, loading, allPieces.length, heroId, looks, pieceById, setHeroId, setLooks, setAdjusts])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const waiting = lookIds.filter((id) => !stories.get(id)?.cutoutUrl && !cutoutFailed[id])
  const failed = lookIds.filter((id) => cutoutFailed[id] && !stories.get(id)?.cutoutUrl)

  const heroOptions: PickerOption[] = useMemo(
    () =>
      eligible.flatMap((row) => {
        if (row.marketingEntityId === heroId) return []
        const story = stories.get(row.marketingEntityId)
        return story ? [optionFor(story, entityId)] : []
      }),
    [eligible, heroId, stories, entityId]
  )

  function chooseHero(id: string) {
    setHeroId(id)
    setLooks(null)
    setAdjusts({})
    setSelected(null)
  }

  function rebuild() {
    setLooks(null)
    setAdjusts({})
    setSelected(null)
  }

  function slidePieces(look: string[]): SlidePiece[] {
    return look.flatMap((id) => {
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

  function updateLook(index: number, ids: string[]) {
    setLooks((current) => (current ? current.map((look, i) => (i === index ? ids : look)) : current))
  }

  function swap(index: number, pieceId: string) {
    if (!looks) return
    const next = nextSwap({ pieces, outfit: looks[index], currentId: pieceId })
    if (!next) {
      toast.message("Nothing else in stock fits there.")
      return
    }
    updateLook(index, looks[index].map((id) => (id === pieceId ? next : id)))
  }

  function swapOptions(index: number, pieceId: string): PickerOption[] {
    if (!looks) return []
    return swapCandidates({ pieces, outfit: looks[index], currentId: pieceId }).flatMap((piece) => {
      const story = stories.get(piece.id)
      return story ? [optionFor(story, entityId)] : []
    })
  }

  function setAdjust(look: number, pieceId: string, next: LayerAdjust | null) {
    setAdjusts((current) => {
      const lookAdjusts = { ...current[look] }
      if (next) lookAdjusts[pieceId] = next
      else delete lookAdjusts[pieceId]
      return { ...current, [look]: lookAdjusts }
    })
  }

  /** Bring the selected piece to the front (+1) or send it to the back (-1). */
  function restack(direction: 1 | -1) {
    if (!selected || !looks) return
    const current = adjusts[selected.look] ?? {}
    const levels = looks[selected.look].map((id) => current[id]?.z ?? 0)
    const z = direction === 1 ? Math.max(...levels, 5) + 1 : Math.min(...levels, 0) - 1
    setAdjust(selected.look, selected.pieceId, { ...(current[selected.pieceId] ?? NO_ADJUST), z })
  }

  function heroName(): string {
    if (!heroStory) return "this piece"
    return `${heroStory.designer} ${(pieceType(heroStory.row.title, heroStory.row.brand) ?? "").toLowerCase()}`.trim()
  }

  function buildCaption(): string {
    const lines = (looks ?? []).map((look, index) => {
      const others = look.flatMap((id) => {
        if (id === heroId) return []
        const story = stories.get(id)
        const piece = pieceById.get(id)
        if (!story || !piece) return []
        const details = [formatSizeForText(story.row.size), shortPrice(story.priceLabel)].filter(Boolean).join(", ")
        return [`${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}${details ? ` (${details})` : ""}`]
      })
      return `${lookNames[index] || `Look ${index + 1}`}: ${others.length > 0 ? `with ${others.join(" + ")}` : "on its own"}`
    })
    const heroDetails = heroStory
      ? [formatSizeForText(heroStory.row.size), shortPrice(heroStory.priceLabel)].filter(Boolean).join(", ")
      : ""
    return [
      `One piece, three ways: the ${heroName()}${heroDetails ? ` (${heroDetails})` : ""}.`,
      "",
      ...lines,
      "",
      "Every piece is on our racks right now. Shop through the link in our bio, or come try them on in store.",
    ].join("\n")
  }

  async function sendToStudio() {
    if (!looks) return
    setSelected(null)
    setSending(true)
    try {
      const urls: string[] = []
      for (const node of slideNodes.current.slice(0, looks.length + 1)) {
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
        One piece, three ways is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Feed carousel · 4 slides, 4:5
          </p>
          <h1 className="brand-typewriter text-xl">One piece, three ways</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Choose one piece from the racks and it&apos;s styled three ways with
            the rest of the stock. Swap anything but the piece itself, and drag
            to move, resize or tilt. Kept as a draft on this device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Carousel background">
            {kit.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackgroundId(bg.id)}
                title={bg.name}
                aria-label={`Use ${bg.name} for the carousel`}
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
            disabled={!heroId || loading || sending}
            onClick={() => {
              rebuild()
              void reload()
            }}
            title="Style the piece again from current stock"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Shuffle className="mr-2 size-4" />}
            Restyle
          </Button>
          <Button
            type="button"
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={!looks || waiting.length > 0 || sending}
            onClick={() => void sendToStudio()}
            title={waiting.length > 0 ? "Waiting for cutouts" : "Open these slides in Studio"}
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slides…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      {waiting.length > 0 && heroId ? (
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

      {!loaded ? (
        <p className="flex items-center gap-2 text-sm text-mad-black/60">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading stock from the website…
        </p>
      ) : allPieces.length === 0 ? (
        <p className="text-sm text-mad-black/60">No live stock to style yet.</p>
      ) : !heroId || !heroStory ? (
        <div className="grid max-w-md gap-3 border-2 border-dashed border-mad-black/40 bg-white p-5 text-sm">
          <p>Which piece are you styling? Search by brand, colour or type.</p>
          <div>
            <PiecePicker label="piece" adding addText="Choose the piece" options={heroOptions} onPick={chooseHero} />
          </div>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <li className="flex min-w-0 flex-col gap-2">
            <ThreeWaysCoverSlide
              ref={(node) => {
                slideNodes.current[0] = node
              }}
              background={background}
              brandName={entityName}
              kicker={cover.kicker}
              title={cover.title}
              imageUrl={heroStory.cutoutUrl ? heroStory.imageUrl : null}
              designer={heroStory.designer}
              detail={[heroStory.sizeLabel, shortPrice(heroStory.priceLabel)].filter(Boolean).join(" · ") || null}
              className="rounded-sm shadow-md"
            />
            <div className="flex min-h-7 items-center justify-between gap-2">
              <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">Slide 1 · The piece</p>
              <PiecePicker label="piece" options={heroOptions} onPick={chooseHero} />
            </div>
            <label className="grid gap-0.5 text-[11px]">
              <span className="text-mad-black/60">Small line</span>
              <input
                id="three-ways-kicker"
                value={cover.kicker}
                maxLength={30}
                onChange={(event) => setCover((current) => ({ ...current, kicker: event.target.value }))}
                className="h-8 border-2 border-mad-black/40 bg-white px-2 text-xs uppercase tracking-wider"
              />
            </label>
            <label className="grid gap-0.5 text-[11px]">
              <span className="text-mad-black/60">Title</span>
              <input
                id="three-ways-title"
                value={cover.title}
                maxLength={24}
                onChange={(event) => setCover((current) => ({ ...current, title: event.target.value }))}
                className="h-8 border-2 border-mad-black bg-white px-2 text-xs font-semibold uppercase tracking-wider"
              />
            </label>
            <div className="grid gap-1">
              <span className="text-[11px] text-mad-black/60">Look names</span>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Look name quick picks">
                {LOOK_NAME_PICKS.map((pick) => {
                  const on = pick.every((name, i) => lookNames[i] === name)
                  return (
                    <button
                      key={pick.join()}
                      type="button"
                      onClick={() => setLookNames(pick)}
                      aria-pressed={on}
                      className={cn(
                        "border px-2 py-0.5 text-[11px]",
                        on ? "border-mad-black bg-mad-black text-mad-white" : "border-mad-black/30 hover:border-mad-black"
                      )}
                    >
                      {pick.join(" / ")}
                    </button>
                  )
                })}
              </div>
            </div>
          </li>

          {looks === null ? (
            <li className="flex items-center gap-2 text-sm text-mad-black/60">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Styling…
            </li>
          ) : (
            looks.map((look, index) => {
              const addable = addableSlots({ pieces, outfit: look })
              const name = lookNames[index] ?? ""
              return (
                <li key={index} className="flex min-w-0 flex-col gap-2">
                  <OutfitSlide
                    ref={(node) => {
                      slideNodes.current[index + 1] = node
                    }}
                    background={background}
                    brandName={entityName}
                    day={name || `Look ${index + 1}`}
                    vibe={`${index + 1} of ${looks.length}`}
                    pieces={slidePieces(look)}
                    adjust={adjusts[index]}
                    onAdjust={(pieceId, next) => setAdjust(index, pieceId, next)}
                    selectedId={selected?.look === index ? selected.pieceId : null}
                    onSelect={(pieceId) => setSelected(pieceId ? { look: index, pieceId } : null)}
                    className="rounded-sm shadow-md"
                  />
                  <div className="flex min-h-7 items-center justify-between gap-2">
                    <input
                      id={`three-ways-look-${index}`}
                      value={name}
                      maxLength={14}
                      aria-label={`Name for look ${index + 1}`}
                      onChange={(event) =>
                        setLookNames((current) => current.map((value, i) => (i === index ? event.target.value : value)))
                      }
                      className="h-7 min-w-0 flex-1 border-2 border-mad-black/40 bg-white px-2 text-xs uppercase tracking-wider"
                    />
                    <div className="flex items-center gap-0.5">
                      {selected?.look === index ? (
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
                          aria-label={`Reset look ${index + 1}'s layout`}
                          className="flex size-7 items-center justify-center text-mad-black/70 hover:text-mad-black"
                        >
                          <Undo2 className="size-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 gap-1">
                    {look.map((id) => {
                      const story = stories.get(id)
                      const piece = pieceById.get(id)
                      if (!story || !piece) return null
                      const isHero = id === heroId
                      return (
                        <li
                          key={id}
                          className={cn(
                            "flex items-center gap-2 border bg-white px-2 py-1",
                            isHero ? "border-mad-black" : "border-mad-black/15"
                          )}
                        >
                          <span className="w-16 shrink-0 font-typewriter text-[10px] uppercase text-mad-black/55">
                            {OUTFIT_SLOT_LABELS[piece.slot]}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs" title={story.row.title}>
                            {story.designer}
                            {formatSizeForText(story.row.size) ? ` · ${formatSizeForText(story.row.size)}` : ""}
                          </span>
                          {cuttingId === id ? <Scissors className="size-3 animate-pulse text-mad-black/50" aria-hidden /> : null}
                          {isHero ? (
                            <span title="The piece is in every look" className="flex size-6 items-center justify-center text-mad-black/60">
                              <Lock className="size-3.5" aria-label="The piece is in every look" />
                            </span>
                          ) : (
                            <>
                              <PiecePicker
                                label={OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}
                                options={swapOptions(index, id)}
                                onPick={(next) => updateLook(index, look.map((pieceId) => (pieceId === id ? next : pieceId)))}
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
                                onClick={() => updateLook(index, look.filter((pieceId) => pieceId !== id))}
                                title="Take this piece out"
                                aria-label={`Remove ${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}`}
                                className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
                              >
                                <X className="size-3.5" aria-hidden />
                              </button>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {addable.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {addable.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => updateLook(index, addPiece({ pieces, outfit: look, slot }))}
                          className="flex items-center gap-1 border border-dashed border-mad-black/40 px-2 py-0.5 text-[11px] text-mad-black/70 hover:border-mad-black hover:text-mad-black"
                        >
                          <Plus className="size-3" aria-hidden /> {OUTFIT_SLOT_LABELS[slot]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </li>
              )
            })
          )}
        </ol>
      )}
    </div>
  )
}
