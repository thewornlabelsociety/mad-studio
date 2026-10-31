"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  ArrowRight,
  BringToFront,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scissors,
  SendToBack,
  Share2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { isAdjusted, NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import { INSPO_LAYER_ID, InspoVsWlsSlide } from "@/components/templates/inspo-slide"
import type { SlidePiece } from "@/components/templates/outfit-slides"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { requestCutout } from "@/lib/media/request-cutout"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { proxiedPhotoUrl, shrinkPhoto, uploadPhoto } from "@/lib/templates/upload-photo"
import { bakeStoryPng, shareOrDownloadStory, useKitStories } from "@/lib/templates/use-kit-stories"
import { OUTFIT_SLOT_LABELS, toOutfitPiece } from "@/lib/templates/week-outfits"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { cn } from "@/lib/utils"

/** Enough pieces to make the look; more crowds the half slide. */
const INSPO_PIECES_MAX = 5

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

/** The uploaded inspo photo: the original, and its cutout once made. */
type InspoPhoto = { url: string; cutoutUrl: string | null; useCutout: boolean }

function shortPrice(label: string | null | undefined): string | null {
  if (!label || label === "—") return null
  return label.replace(/\.00$/, "")
}

/** Wednesday's post: an inspo look beside the same look from the racks. */
export function WlsInspoWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const slideNode = useRef<HTMLDivElement | null>(null)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  // Kept as a draft on this device, so leaving the screen keeps the post.
  const draftKey = `mad.inspoDraft.${entityId}`
  const [photo, setPhoto] = useRememberedState<InspoPhoto | null>(`${draftKey}.photo`, null)
  const [credit, setCredit] = useRememberedState<string>(`${draftKey}.credit`, "")
  const [pieceIds, setPieceIds] = useRememberedState<string[]>(`${draftKey}.pieces`, [])
  const [adjusts, setAdjusts] = useRememberedState<Record<string, LayerAdjust>>(`${draftKey}.placements`, {})
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`${draftKey}.background`, null)
  const [selected, setSelected] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [cutting, setCutting] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)

  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: pieceIds,
  })

  const pieceById = useMemo(() => new Map(eligible.map((row) => [row.marketingEntityId, toOutfitPiece(row)])), [eligible])

  // A kept draft may name pieces that have since sold: drop them.
  useEffect(() => {
    if (!loaded || loading || eligible.length === 0) return
    if (pieceIds.every((id) => pieceById.has(id))) return
    setPieceIds(pieceIds.filter((id) => pieceById.has(id)))
  }, [loaded, loading, eligible.length, pieceIds, pieceById, setPieceIds])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const waiting = pieceIds.filter((id) => !stories.get(id)?.cutoutUrl && !cutoutFailed[id])
  const inspoUrl = photo
    ? proxiedPhotoUrl(photo.useCutout && photo.cutoutUrl ? photo.cutoutUrl : photo.url, entityId)
    : null
  const inspoCutout = Boolean(photo?.useCutout && photo.cutoutUrl)

  const slidePieces: SlidePiece[] = pieceIds.flatMap((id) => {
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

  /** Everything in stock not already in the look, for the search panel. */
  const options: PickerOption[] = useMemo(
    () =>
      eligible.flatMap((row) => {
        if (pieceIds.includes(row.marketingEntityId)) return []
        const story = stories.get(row.marketingEntityId)
        if (!story) return []
        const image = story.cutoutUrl ?? row.sourceImageUrls[0] ?? null
        return [
          {
            id: row.marketingEntityId,
            brand: story.designer,
            title: row.title,
            detail: [formatSizeForText(row.size), shortPrice(story.priceLabel), row.vibe].filter(Boolean).join(" · "),
            thumb: image ? proxiedImageUrl(image, entityId) : null,
            searchText: [row.title, row.brand, row.description, row.category, row.vibe, row.size].filter(Boolean).join(" "),
          },
        ]
      }),
    [eligible, pieceIds, stories, entityId]
  )

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    try {
      const url = await uploadPhoto(await shrinkPhoto(file), entityId)
      setPhoto({ url, cutoutUrl: null, useCutout: false })
      setAdjust(INSPO_LAYER_ID, null)
    } catch {
      toast.error("Couldn't add the photo. Try another one.")
    } finally {
      setPhotoBusy(false)
    }
  }

  /** Cut the look out of its background (made once, then switched on and off). */
  async function toggleCutout() {
    if (!photo) return
    if (photo.cutoutUrl) {
      setPhoto({ ...photo, useCutout: !photo.useCutout })
      return
    }
    setCutting(true)
    try {
      const cutoutUrl = await requestCutout({ imageUrl: photo.url, entityId })
      setPhoto({ ...photo, cutoutUrl, useCutout: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't cut out the photo.")
    } finally {
      setCutting(false)
    }
  }

  function addPiece(id: string) {
    if (pieceIds.length >= INSPO_PIECES_MAX) {
      toast.message(`The look takes up to ${INSPO_PIECES_MAX} pieces.`)
      return
    }
    setPieceIds([...pieceIds, id])
  }

  function removePiece(id: string) {
    setPieceIds(pieceIds.filter((row) => row !== id))
    setAdjust(id, null)
    if (selected === id) setSelected(null)
  }

  function setAdjust(layerId: string, next: LayerAdjust | null) {
    setAdjusts((current) => {
      const out = { ...current }
      if (next) out[layerId] = next
      else delete out[layerId]
      return out
    })
  }

  /** Bring the selected layer to the front (+1) or send it to the back (-1). */
  function restack(direction: 1 | -1) {
    if (!selected) return
    const levels = [INSPO_LAYER_ID, ...pieceIds].map((id) => adjusts[id]?.z ?? 0)
    const z = direction === 1 ? Math.max(...levels, 5) + 1 : Math.min(...levels, 0) - 1
    setAdjust(selected, { ...(adjusts[selected] ?? NO_ADJUST), z })
  }

  function caption(): string {
    const lines = pieceIds.flatMap((id, index) => {
      const story = stories.get(id)
      const piece = pieceById.get(id)
      if (!story || !piece) return []
      const details = [formatSizeForText(story.row.size), shortPrice(story.priceLabel)].filter(Boolean).join(", ")
      return [`${index + 1}. ${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}${details ? ` (${details})` : ""}`]
    })
    return [
      "Inspo vs WLS. The look, and our version from the racks.",
      "",
      ...lines,
      ...(credit.trim() ? ["", credit.trim()] : []),
      "",
      "One of each, so be quick. Shop through the link in our bio or come try it on in store.",
    ].join("\n")
  }

  async function bake() {
    setSelected(null)
    // Let the selection outline clear before the slide is drawn.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    if (!slideNode.current) throw new Error("The slide isn't ready yet.")
    return bakeStoryPng(slideNode.current)
  }

  async function sendToStudio() {
    setSending(true)
    try {
      const { blob } = await bake()
      const url = await uploadRenderedPng(blob, entityId)
      saveStudioSlidesHandoff(entityId, { urls: [url], caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the slide.")
      setSending(false)
    }
  }

  async function saveImage() {
    setSaving(true)
    try {
      const baked = await bake()
      const result = await shareOrDownloadStory({ ...baked, filename: "wls-inspo-vs-wls.png" })
      if (result === "downloaded") toast.success("Image saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setSaving(false)
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        Inspo vs WLS is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  const ready = Boolean(photo) && slidePieces.length > 0 && waiting.length === 0 && !photoBusy && !cutting

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Wednesday post · 1 slide, 4:5
          </p>
          <h1 className="brand-typewriter text-xl">Inspo vs WLS</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Add the inspo photo, then build the same look from the racks.
            Drag any piece to move it, pull its corner to resize or its top
            dot to tilt. Your post is kept as a draft on this device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Slide background">
            {kit.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackgroundId(bg.id)}
                title={bg.name}
                aria-label={`Use ${bg.name} for the slide`}
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
            disabled={loading}
            onClick={() => void reload()}
            title="Check the shop for new stock"
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
            Reload
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-2 border-mad-black"
            disabled={!ready || saving}
            onClick={() => void saveImage()}
            title="Save the slide to this device"
          >
            {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
            Save image
          </Button>
          <Button
            type="button"
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={!ready || sending}
            onClick={() => void sendToStudio()}
            title={waiting.length > 0 ? "Waiting for cutouts" : "Open the slide in Studio"}
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slide…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <section aria-label="Slide" className="grid gap-2">
          <InspoVsWlsSlide
            ref={slideNode}
            background={background}
            brandName={entityName}
            inspoUrl={inspoUrl}
            inspoCutout={inspoCutout}
            credit={credit}
            pieces={slidePieces}
            adjust={adjusts}
            onAdjust={(layerId, next) => setAdjust(layerId, next)}
            selectedId={selected}
            onSelect={setSelected}
            className="rounded-sm shadow-md"
          />
          <div className="flex min-h-9 flex-wrap items-center gap-1.5">
            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => restack(1)}
                  title="Bring to front"
                  aria-label="Bring to front"
                  className="flex size-8 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
                >
                  <BringToFront className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => restack(-1)}
                  title="Send to back"
                  aria-label="Send to back"
                  className="flex size-8 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
                >
                  <SendToBack className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setAdjust(selected, null)}
                  disabled={!isAdjusted(adjusts[selected])}
                  title="Put back in its spot"
                  aria-label="Put back in its spot"
                  className="flex size-8 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6] disabled:opacity-40"
                >
                  <RotateCcw className="size-4" aria-hidden />
                </button>
              </>
            ) : (
              <p className="text-xs text-mad-black/55">Tap a piece on the slide to move, resize or restack it.</p>
            )}
          </div>
        </section>

        <div className="grid content-start gap-6">
          <section aria-labelledby="inspo-photo" className="grid gap-2">
            <h2 id="inspo-photo" className="font-typewriter text-xs uppercase tracking-widest">
              The inspo
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 border-2 border-mad-black px-3 text-sm hover:bg-[#F4EFE6]",
                  photoBusy && "pointer-events-none opacity-60"
                )}
                title={photo ? "Use a different photo" : "Add the inspo photo"}
              >
                {photoBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                {photo ? "Change photo" : "Add photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    void onPhoto(event.target.files?.[0])
                    event.target.value = ""
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void toggleCutout()}
                disabled={!photo || cutting}
                aria-pressed={inspoCutout}
                title={inspoCutout ? "Show the whole photo" : "Cut the look out of its background"}
                className={cn(
                  "flex h-9 items-center gap-2 border-2 border-mad-black px-3 text-sm disabled:opacity-40",
                  inspoCutout ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                )}
              >
                {cutting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Scissors className="size-4" aria-hidden />}
                {cutting ? "Cutting out…" : "Cut out"}
              </button>
              {photo ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhoto(null)
                    setAdjust(INSPO_LAYER_ID, null)
                  }}
                  title="Remove the photo"
                  aria-label="Remove the photo"
                  className="flex size-9 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            <label className="grid max-w-sm gap-1 text-xs">
              Credit (optional)
              <input
                type="text"
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
                placeholder="Inspo: @handle"
                maxLength={60}
                className="h-9 border-2 border-mad-black px-2 text-sm"
              />
            </label>
          </section>

          <section aria-labelledby="inspo-pieces" className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="inspo-pieces" className="font-typewriter text-xs uppercase tracking-widest">
                From the racks · {pieceIds.length} of {INSPO_PIECES_MAX}
              </h2>
              {pieceIds.length < INSPO_PIECES_MAX ? (
                <PiecePicker label="piece" options={options} onPick={addPiece} adding />
              ) : null}
            </div>
            {!loaded ? (
              <p className="flex items-center gap-2 text-sm text-mad-black/60">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the stock…
              </p>
            ) : pieceIds.length === 0 ? (
              <p className="max-w-sm border-2 border-dashed border-mad-black/40 bg-white p-4 text-sm text-mad-black/70">
                Search the stock by colour, brand or type to add the pieces
                that make the look.
              </p>
            ) : (
              <ol className="grid max-w-md gap-1.5">
                {pieceIds.map((id, index) => {
                  const story = stories.get(id)
                  if (!story) return null
                  const cutting = cuttingId === id || (!story.cutoutUrl && !cutoutFailed[id])
                  return (
                    <li key={id} className="flex items-center gap-2 border-2 border-mad-black bg-white px-2 py-1.5">
                      <span className="w-4 text-center font-typewriter text-xs">{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">{story.designer}</span>
                        <span className="block truncate text-[11px] text-mad-black/60">{story.row.title}</span>
                      </span>
                      {cutting ? (
                        <span className="flex items-center gap-1 text-[11px] text-mad-black/55">
                          <Scissors className="size-3.5 animate-pulse" aria-hidden /> Cutting out
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removePiece(id)}
                        title="Take out of the look"
                        aria-label={`Take ${story.designer} out of the look`}
                        className="flex size-7 items-center justify-center text-mad-black/60 hover:text-mad-black"
                      >
                        <X className="size-4" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
