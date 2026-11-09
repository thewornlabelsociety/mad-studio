"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, ImagePlus, Loader2, Scissors, Share2, X } from "lucide-react"
import { toast } from "sonner"

import type { SlidePiece } from "@/components/templates/outfit-slides"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { CENTRED, StaffOutfitSlide, type PhotoFocus } from "@/components/templates/staff-outfit-slides"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { pieceType } from "@/lib/templates/story-card-style"
import { proxiedPhotoUrl, shrinkPhoto, uploadPhoto } from "@/lib/templates/upload-photo"
import { bakeStoryPng, shareOrDownloadStory, useKitStories } from "@/lib/templates/use-kit-stories"
import { toOutfitPiece } from "@/lib/templates/week-outfits"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { cn } from "@/lib/utils"

/** Enough to tag a whole outfit; more crowds the list. */
const STAFF_PIECES_MAX = 5
/** Names kept for one-tap picks next time. */
const STAFF_NAMES_KEPT = 6

const HEADING_PICKS = ["Outfit check", "Staff pick", "What we're wearing"]

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

/** A staff member's outfit from the racks: their photo, their name and every piece tagged with size and price. */
export function WlsStaffOutfitWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const feedNode = useRef<HTMLDivElement | null>(null)
  const storyNode = useRef<HTMLDivElement | null>(null)
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  // Kept as a draft on this device, so leaving the screen keeps the post.
  const draftKey = `mad.staffOutfit.${entityId}`
  const [photoUrl, setPhotoUrl] = useRememberedState<string | null>(`${draftKey}.photo`, null)
  const [focus, setFocus] = useRememberedState<PhotoFocus>(`${draftKey}.focus`, CENTRED)
  const [heading, setHeading] = useRememberedState<string>(`${draftKey}.heading`, HEADING_PICKS[0])
  const [name, setName] = useRememberedState<string>(`${draftKey}.name`, "")
  const [line, setLine] = useRememberedState<string>(`${draftKey}.line`, "")
  const [pieceIds, setPieceIds] = useRememberedState<string[]>(`${draftKey}.pieces`, [])
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`${draftKey}.background`, null)
  const [staffNames, setStaffNames] = useRememberedState<string[]>(`mad.staffNames.${entityId}`, [])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [busy, setBusy] = useState<"studio" | "story" | null>(null)

  const { kit, eligible, loaded, loading, stories, cuttingId, cutoutFailed } = useKitStories({
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

  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const waiting = pieceIds.filter((id) => !stories.get(id)?.cutoutUrl && !cutoutFailed[id])
  const shownPhoto = photoUrl ? proxiedPhotoUrl(photoUrl, entityId) : null

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

  /** Everything in stock not already tagged, for the search panel. */
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
      setPhotoUrl(await uploadPhoto(await shrinkPhoto(file), entityId))
      setFocus(CENTRED)
    } catch {
      toast.error("Couldn't add the photo. Try another one.")
    } finally {
      setPhotoBusy(false)
    }
  }

  function addPiece(id: string) {
    if (pieceIds.length >= STAFF_PIECES_MAX) {
      toast.message(`An outfit check takes up to ${STAFF_PIECES_MAX} pieces.`)
      return
    }
    setPieceIds([...pieceIds, id])
  }

  /** Keep the name for a one-tap pick next time. */
  function rememberName() {
    const clean = name.trim()
    if (!clean) return
    setStaffNames((current) => [clean, ...current.filter((row) => row.toLowerCase() !== clean.toLowerCase())].slice(0, STAFF_NAMES_KEPT))
  }

  function caption(): string {
    const lines = pieceIds.flatMap((id, index) => {
      const story = stories.get(id)
      if (!story) return []
      const type = pieceType(story.row.title, story.row.brand)
      const details = [formatSizeForText(story.row.size), shortPrice(story.priceLabel)].filter(Boolean).join(", ")
      return [`${index + 1}. ${story.designer}${type ? ` ${type.toLowerCase()}` : ""}${details ? ` (${details})` : ""}`]
    })
    const who = name.trim() ? `${heading || "Outfit check"}: ${name.trim()}` : heading || "Outfit check"
    return [
      line.trim() ? `${who}. ${line.trim()}` : `${who}.`,
      "",
      ...lines,
      "",
      "Every piece is from our racks. Shop through the link in our bio, or come try them on in store.",
    ].join("\n")
  }

  async function run(kind: "studio" | "story", work: () => Promise<void>) {
    setBusy(kind)
    rememberName()
    try {
      await work()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setBusy(null)
    }
  }

  const sendToStudio = () =>
    run("studio", async () => {
      if (!feedNode.current) return
      const { blob } = await bakeStoryPng(feedNode.current)
      const url = await uploadRenderedPng(blob, entityId)
      saveStudioSlidesHandoff(entityId, { urls: [url], caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    })

  const saveStory = () =>
    run("story", async () => {
      if (!storyNode.current) return
      const baked = await bakeStoryPng(storyNode.current)
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "staff"
      const result = await shareOrDownloadStory({ ...baked, filename: `wls-outfit-check-${slug}.png` })
      if (result === "downloaded") toast.success("Story image saved.")
    })

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        Staff outfit check is only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  const ready = Boolean(photoUrl) && slidePieces.length > 0 && waiting.length === 0
  const field = "h-9 w-full border-2 border-mad-black bg-white px-2 text-sm"

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Feed card and Story · 4:5 and 9:16
          </p>
          <h1 className="brand-typewriter text-xl">Staff outfit check</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            A photo of the team in pieces from the racks, with who&apos;s wearing
            it and every piece tagged with its size and price.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5" role="group" aria-label="Background">
            {kit.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackgroundId(bg.id)}
                title={bg.name}
                aria-label={`Use ${bg.name}`}
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
            disabled={!ready || busy != null}
            onClick={() => void saveStory()}
            title={!ready ? "Add a photo and at least one piece" : "Save the Story image"}
          >
            {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
            Save Story
          </Button>
          <Button
            type="button"
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={!ready || busy != null}
            onClick={() => void sendToStudio()}
            title={!ready ? "Add a photo and at least one piece" : "Open the feed card in Studio"}
          >
            {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {busy === "studio" ? "Preparing…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <section aria-labelledby="staff-photo" className="grid gap-2">
            <h2 id="staff-photo" className="font-typewriter text-xs uppercase tracking-widest">
              The photo
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2 border-2 border-mad-black px-3 text-sm hover:bg-[#F4EFE6]",
                  photoBusy && "pointer-events-none opacity-60"
                )}
                title={photoUrl ? "Use a different photo" : "Add the outfit photo"}
              >
                {photoBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                {photoUrl ? "Change photo" : "Add photo"}
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
              {photoUrl ? (
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  title="Remove the photo"
                  aria-label="Remove the photo"
                  className="flex size-9 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            {photoUrl ? (
              <div className="grid gap-1 text-xs">
                <label className="grid grid-cols-[88px_1fr] items-center gap-2">
                  <span className="text-mad-black/60">Left / right</span>
                  <input type="range" min={0} max={100} value={focus.x} onChange={(e) => setFocus({ ...focus, x: Number(e.target.value) })} />
                </label>
                <label className="grid grid-cols-[88px_1fr] items-center gap-2">
                  <span className="text-mad-black/60">Up / down</span>
                  <input type="range" min={0} max={100} value={focus.y} onChange={(e) => setFocus({ ...focus, y: Number(e.target.value) })} />
                </label>
              </div>
            ) : (
              <p className="text-xs text-mad-black/60">A full-length mirror photo works best.</p>
            )}
          </section>

          <section aria-labelledby="staff-words" className="grid gap-2">
            <h2 id="staff-words" className="font-typewriter text-xs uppercase tracking-widest">
              The words
            </h2>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Heading quick picks">
              {HEADING_PICKS.map((pick) => (
                <button
                  key={pick}
                  type="button"
                  onClick={() => setHeading(pick)}
                  aria-pressed={heading === pick}
                  className={cn(
                    "border px-2 py-0.5 text-[11px]",
                    heading === pick ? "border-mad-black bg-mad-black text-mad-white" : "border-mad-black/30 hover:border-mad-black"
                  )}
                >
                  {pick}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-xs">
              <span className="font-typewriter uppercase tracking-widest">Heading</span>
              <input id="staff-heading" className={field} value={heading} maxLength={22} onChange={(e) => setHeading(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="font-typewriter uppercase tracking-widest">Who&apos;s wearing it</span>
              <input
                id="staff-name"
                className={field}
                value={name}
                maxLength={24}
                placeholder="e.g. Kim"
                onChange={(e) => setName(e.target.value)}
                onBlur={rememberName}
              />
            </label>
            {staffNames.length > 0 ? (
              <div className="flex flex-wrap gap-1" role="group" aria-label="Team names">
                {staffNames.map((staff) => (
                  <button
                    key={staff}
                    type="button"
                    onClick={() => setName(staff)}
                    aria-pressed={name.trim() === staff}
                    className={cn(
                      "border px-2 py-0.5 text-[11px]",
                      name.trim() === staff ? "border-mad-black bg-mad-black text-mad-white" : "border-mad-black/30 hover:border-mad-black"
                    )}
                  >
                    {staff}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="grid gap-1 text-xs">
              <span className="font-typewriter uppercase tracking-widest">Line (optional)</span>
              <input
                id="staff-line"
                className={field}
                value={line}
                maxLength={60}
                placeholder="e.g. Wearing it to work this week"
                onChange={(e) => setLine(e.target.value)}
              />
            </label>
          </section>

          <section aria-labelledby="staff-pieces" className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="staff-pieces" className="font-typewriter text-xs uppercase tracking-widest">
                What they&apos;re wearing · {pieceIds.length} of {STAFF_PIECES_MAX}
              </h2>
              {loaded && pieceIds.length < STAFF_PIECES_MAX ? (
                <PiecePicker label="piece" options={options} onPick={addPiece} adding quiet addText="Add a piece" />
              ) : null}
            </div>
            {!loaded ? (
              <p className="flex items-center gap-2 text-xs text-mad-black/60">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Loading stock from the website…
              </p>
            ) : pieceIds.length === 0 ? (
              <p className="text-xs text-mad-black/60">Search the stock for each piece in the photo.</p>
            ) : (
              <ul className="grid gap-1">
                {pieceIds.map((id, index) => {
                  const story = stories.get(id)
                  if (!story) return null
                  return (
                    <li key={id} className="flex items-center gap-2 border border-mad-black/15 bg-white px-2 py-1 text-xs">
                      <span className="w-4 shrink-0 font-typewriter text-mad-black/55">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate" title={story.row.title}>
                        {story.designer}
                        {formatSizeForText(story.row.size) ? ` · ${formatSizeForText(story.row.size)}` : ""}
                      </span>
                      {cuttingId === id ? <Scissors className="size-3 animate-pulse text-mad-black/50" aria-hidden /> : null}
                      <button
                        type="button"
                        onClick={() => setPieceIds(pieceIds.filter((row) => row !== id))}
                        title="Take this piece out"
                        aria-label={`Remove ${story.designer}`}
                        className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex w-[320px] max-w-full flex-col gap-2">
            <StaffOutfitSlide
              ref={feedNode}
              background={background}
              brandName={entityName}
              photoUrl={shownPhoto}
              focus={focus}
              heading={heading}
              name={name}
              line={line}
              pieces={slidePieces}
              className="rounded-sm shadow-md"
            />
            <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">Feed · 4:5</p>
          </div>
          <div className="flex w-[220px] max-w-full flex-col gap-2">
            <StaffOutfitSlide
              ref={storyNode}
              story
              background={background}
              brandName={entityName}
              photoUrl={shownPhoto}
              focus={focus}
              heading={heading}
              name={name}
              line={line}
              pieces={slidePieces}
              className="rounded-md shadow-md"
            />
            <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/55">Story · 9:16</p>
          </div>
        </div>
      </div>
    </div>
  )
}
