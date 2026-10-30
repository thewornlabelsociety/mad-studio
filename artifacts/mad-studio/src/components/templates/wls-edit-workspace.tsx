"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowRight,
  BringToFront,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  SendToBack,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { isAdjusted, NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import { AnnouncementCard, AnnouncementStory, type Announcement } from "@/components/templates/announcement-slides"
import {
  EditItemSlide,
  EditPhotoSlide,
  type CardAlign,
  type PillFill,
  type PillShape,
} from "@/components/templates/edit-slides"
import { OutfitSlide, type SlidePiece } from "@/components/templates/outfit-slides"
import { PiecePicker, type PickerOption } from "@/components/templates/piece-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import type { GarmentSlot } from "@/lib/inventory/listing-garment"
import { formatSizeForText } from "@/lib/studio/canvas-size-tag-label"
import { proxiedImageUrl, uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { proxiedPhotoUrl, shrinkPhoto, uploadPhoto } from "@/lib/templates/upload-photo"
import { bakeStoryPng, shareOrDownloadStory, useKitStories, type KitStory } from "@/lib/templates/use-kit-stories"
import { OUTFIT_SLOT_LABELS, toOutfitPiece } from "@/lib/templates/week-outfits"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { useRememberedState } from "@/lib/use-remembered-state"
import { cn } from "@/lib/utils"

/** Title, flatlay and eight more (pieces and photos) fill a ten-slide carousel. */
const EDIT_SLIDES_MAX = 8
/** More than this crowds the flatlay. */
const FLATLAY_PIECES_MAX = 6
/** The flatlay's add buttons, each searching that kind of piece. */
const FLATLAY_KINDS: Array<{ label: string; slots: GarmentSlot[] }> = [
  { label: "Top", slots: ["top"] },
  { label: "Bottom", slots: ["bottom"] },
  { label: "Dress", slots: ["dress"] },
  { label: "Layer", slots: ["outerwear"] },
  { label: "Accessory", slots: ["accessory", "other"] },
  { label: "Footwear", slots: ["shoes"] },
]
/** What each piece card can show, switched on and off for the whole edit. */
type CardField = "number" | "brand" | "category" | "vibe" | "size" | "price"
const CARD_FIELDS: Array<{ id: CardField; label: string }> = [
  { id: "number", label: "Eyebrow" },
  { id: "brand", label: "Brand" },
  { id: "category", label: "Sub category" },
  { id: "vibe", label: "Vibe" },
  { id: "size", label: "Size" },
  { id: "price", label: "Price" },
]
const DEFAULT_CARD_FIELDS: Record<CardField, boolean> = {
  number: true,
  brand: true,
  category: false,
  vibe: false,
  size: true,
  price: true,
}

const PILL_FILLS: Array<{ id: PillFill; label: string }> = [
  { id: "outline", label: "Outline" },
  { id: "accent", label: "Accent colour" },
  { id: "ink", label: "Text colour" },
  { id: "cream", label: "Cream" },
]
const PILL_SHAPES: Array<{ id: PillShape; label: string }> = [
  { id: "round", label: "Round" },
  { id: "soft", label: "Soft corner" },
  { id: "square", label: "Square" },
]

/** One labelled line of the Card style panel. */
function StyleRow({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", wide && "md:col-span-2")}>
      <span className="w-20 shrink-0 font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">{label}</span>
      {children}
    </div>
  )
}

/** Left, centre and right buttons for something on the cards. */
function AlignButtons({ value, onChange, what }: { value: CardAlign; onChange: (next: CardAlign) => void; what: string }) {
  return (
    <div className="flex border-2 border-mad-black" role="group" aria-label={`Line up ${what}`}>
      {(
        [
          { side: "left", label: "Left", Icon: AlignLeft },
          { side: "center", label: "Centre", Icon: AlignCenter },
          { side: "right", label: "Right", Icon: AlignRight },
        ] as const
      ).map(({ side, label, Icon }) => (
        <button
          key={side}
          type="button"
          onClick={() => onChange(side)}
          aria-pressed={value === side}
          title={`${label}-align ${what}`}
          aria-label={`${label}-align ${what}`}
          className={cn("flex size-7 items-center justify-center", value === side ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]")}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  )
}

/** The kind of piece from its shop title: "Formal Dress Karen Millen in Brown" gives "Formal Dress". */
function pieceType(title: string, brand: string | null): string | null {
  let text = title
  if (brand?.trim()) text = text.replace(new RegExp(brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ")
  text = text.replace(/\s+\bin\b\s.*$/i, "").replace(/\s+/g, " ").trim()
  return text || null
}

/** Quick picks for a piece's fabric pill; anything else can be typed. */
const FABRIC_PICKS = ["Linen", "Silk", "Cotton", "Wool", "Cashmere", "Leather", "Denim", "Satin", "Lace", "Velvet", "Viscose", "Suede"]

/** The fabric the shop listing names, if any (its "Material:" line, or a known fabric in the text). */
function listingFabric(text: string): string | null {
  const material = text.match(/Material:\s*([^·\n]+)/i)?.[1]?.trim()
  if (material) return material.split(/[,/]/)[0].trim().slice(0, 20) || null
  const known = FABRIC_PICKS.find((fabric) => new RegExp(`\\b${fabric}\\b`, "i").test(text))
  return known ?? null
}

/** Click to set a piece's fabric: a suggestion from the listing, quick picks, or your own word. */
function FabricPicker({
  value,
  suggestion,
  pieceName,
  onChange,
}: {
  value: string | null
  suggestion: string | null
  pieceName: string
  onChange: (next: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState("")
  const picks = suggestion && !FABRIC_PICKS.some((pick) => pick.toLowerCase() === suggestion.toLowerCase())
    ? [suggestion, ...FABRIC_PICKS]
    : FABRIC_PICKS
  function choose(next: string | null) {
    onChange(next)
    setOpen(false)
    setCustom("")
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value ? "Change the fabric pill" : "Add a fabric pill, e.g. linen or silk"}
          aria-label={value ? `Fabric for ${pieceName}: ${value}. Change it` : `Add a fabric for ${pieceName}`}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-full border-2 border-mad-black px-2 text-[11px] uppercase tracking-wider",
            value ? "bg-mad-black text-mad-white" : "border-dashed text-mad-black/70 hover:bg-[#F4EFE6]"
          )}
        >
          {value ?? (
            <>
              <Plus className="size-3" aria-hidden /> Fabric
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 rounded-none border-2 border-mad-black p-2">
        <p className="mb-1.5 text-[11px] text-mad-black/60">
          {suggestion ? `The listing says ${suggestion.toLowerCase()}.` : "Pick the fabric, or type your own."}
        </p>
        <div className="flex flex-wrap gap-1">
          {picks.map((pick) => (
            <button
              key={pick}
              type="button"
              onClick={() => choose(pick)}
              aria-pressed={value?.toLowerCase() === pick.toLowerCase()}
              className={cn(
                "rounded-full border-2 border-mad-black px-2 py-0.5 text-[11px] uppercase tracking-wider",
                value?.toLowerCase() === pick.toLowerCase() ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]",
                pick === suggestion && "border-mad-vermillion"
              )}
            >
              {pick}
            </button>
          ))}
        </div>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            if (custom.trim()) choose(custom.trim().slice(0, 20))
          }}
        >
          <input
            type="text"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder="Other, e.g. Merino"
            aria-label="Type a fabric"
            maxLength={20}
            className="h-8 min-w-0 flex-1 border-2 border-mad-black px-2 text-xs"
          />
          <button type="submit" className="h-8 border-2 border-mad-black px-2 text-xs hover:bg-[#F4EFE6]">
            Add
          </button>
        </form>
        {value ? (
          <button type="button" onClick={() => choose(null)} className="mt-2 text-[11px] underline">
            No fabric pill
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/** "New arrivals" in the search: this many of the newest pieces. */
const NEW_ARRIVALS_COUNT = 40

/** Starting points for the title; every word stays editable. */
const TITLE_PICKS = ["Race day ready", "Wedding guest", "Back to work", "Date night", "Long weekend", "Festival edit"]

/** A slide after the title: a shop piece, or a photo of your own. */
type EditEntry = { kind: "piece"; id: string } | { kind: "photo"; id: string; url: string }
/** An entry ready to draw: pieces carry their Story data. */
type EditSlide = { kind: "piece"; id: string; story: KitStory } | { kind: "photo"; id: string; url: string; story: null }

type Props = {
  entityId: string
  entityName: string
  industry?: string | null
  brandIdentity?: { visual_presets?: VisualPresets | null } | null
}

const DEFAULT_TITLE: Announcement = {
  tag: "The edit",
  kicker: "",
  headline: "Race day ready",
  details: [],
  style: "kit",
  headlineFont: "serif",
  accent: "brush",
  align: "center",
}

function shortPrice(label: string | null | undefined): string | null {
  if (!label || label === "—") return null
  return label.replace(/\.00$/, "")
}

function money(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

/** One line from the headline, for the item cards and captions. */
function oneLine(text: string): string {
  return text.split(/\n/).map((part) => part.trim()).filter(Boolean).join(" ")
}

/** A themed edit: a title page, a flatlay of the edit, then a card per piece, for the feed and Stories. */
export function WlsEditWorkspace({ entityId, entityName, industry = null, brandIdentity = null }: Props) {
  const [, navigate] = useLocation()
  const slideNodes = useRef<Array<HTMLDivElement | null>>([])
  const storyNodes = useRef<Record<string, HTMLDivElement | null>>({})
  const isWls = isWornLabelFashionEntity({ name: entityName, industry })
  // Kept as a draft on this device, so leaving the screen keeps the edit.
  const draftKey = `mad.editDraft.${entityId}`
  const [title, setTitle] = useRememberedState<Announcement>(`${draftKey}.title`, DEFAULT_TITLE)
  const [entries, setEntries] = useRememberedState<EditEntry[]>(`${draftKey}.slides`, [])
  // The flatlay's own pieces (null = no flatlay slide). It starts blank;
  // pieces are added by kind (top, bottom, layer…) from the edit or stock.
  const [flatlayIds, setFlatlayIds] = useRememberedState<string[] | null>(`${draftKey}.flatlayPieces`, null)
  const pieceIds = useMemo(() => entries.flatMap((entry) => (entry.kind === "piece" ? [entry.id] : [])), [entries])
  // Pieces on slides first, then any that are only on the flatlay.
  const allPieceIds = useMemo(
    () => [...pieceIds, ...(flatlayIds ?? []).filter((id) => !pieceIds.includes(id))],
    [pieceIds, flatlayIds]
  )
  const [adjusts, setAdjusts] = useRememberedState<Record<string, LayerAdjust>>(`${draftKey}.placements`, {})
  const [cardFields, setCardFields] = useRememberedState<Record<CardField, boolean>>(`${draftKey}.cardFields`, DEFAULT_CARD_FIELDS)
  const [cardAlign, setCardAlign] = useRememberedState<CardAlign>(`${draftKey}.cardAlign`, "center")
  // The fabric pill's own alignment, colour and shape.
  const [pillAlign, setPillAlign] = useRememberedState<CardAlign>(`${draftKey}.pillCorner`, "right")
  const [pillFill, setPillFill] = useRememberedState<PillFill>(`${draftKey}.pillFill`, "outline")
  const [pillShape, setPillShape] = useRememberedState<PillShape>(`${draftKey}.pillShape`, "round")
  // Eyebrow per piece; blank uses "No. 01" and so on.
  const [eyebrows, setEyebrows] = useRememberedState<Record<string, string>>(`${draftKey}.eyebrows`, {})
  // Fabric pill per piece, e.g. LINEN; none until clicked.
  const [fabrics, setFabrics] = useRememberedState<Record<string, string>>(`${draftKey}.fabrics`, {})
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`${draftKey}.background`, null)
  // A card's own colour, by card ("title", "flatlay" or a piece id); the rest use the edit's.
  const [cardBackgrounds, setCardBackgrounds] = useRememberedState<Record<string, string>>(`${draftKey}.cardBackgrounds`, {})
  // The card the colour dots are recolouring, picked by clicking it.
  const [pickedCard, setPickedCard] = useState<string | null>(null)
  const [searchNew, setSearchNew] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoSlideBusy, setPhotoSlideBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  const { kit, eligible, loaded, loading, reload, stories, cuttingId, cutoutFailed } = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: isWls,
    cutoutIds: allPieceIds,
  })

  const pieceById = useMemo(() => new Map(eligible.map((row) => [row.marketingEntityId, toOutfitPiece(row)])), [eligible])

  // A kept draft may name pieces that have since sold: drop them.
  useEffect(() => {
    if (!loaded || loading || eligible.length === 0) return
    if (allPieceIds.every((id) => pieceById.has(id))) return
    setEntries(entries.filter((entry) => entry.kind !== "piece" || pieceById.has(entry.id)))
    if (flatlayIds) setFlatlayIds(flatlayIds.filter((id) => pieceById.has(id)))
  }, [loaded, loading, eligible.length, entries, allPieceIds, flatlayIds, pieceById, setEntries, setFlatlayIds])

  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected])

  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]

  useEffect(() => {
    if (!pickedCard) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickedCard(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pickedCard])

  function cardName(cardId: string): string {
    if (cardId === "title") return "title page"
    if (cardId === "flatlay") return "flatlay"
    return stories.get(cardId)?.designer ?? "piece"
  }

  /** Click a card to recolour just that card with the dots at the top. */
  function pickable(cardId: string, name: string) {
    return {
      role: "button" as const,
      tabIndex: 0,
      title: `Click, then pick a colour at the top for the ${name} card`,
      "aria-label": `Choose the colour for the ${name} card`,
      "aria-pressed": pickedCard === cardId,
      onClick: () => setPickedCard(cardId),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          setPickedCard(cardId)
        }
      },
      className: cn(
        "cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-mad-black",
        pickedCard === cardId && "ring-4 ring-mad-vermillion ring-offset-2"
      ),
    }
  }
  const editLabel = oneLine(title.headline) || "The edit"
  /** A card's colour: its own if picked, else the edit's. */
  const bgFor = (cardId: string) => kit.find((bg) => bg.id === cardBackgrounds[cardId]) ?? background
  /** A piece's eyebrow: your words, or its number in the edit. */
  const eyebrowFor = (id: string) =>
    eyebrows[id]?.trim() || `No. ${String(pieceIds.indexOf(id) + 1).padStart(2, "0")}`
  const chosen = pieceIds.flatMap((id) => {
    const story = stories.get(id)
    return story ? [story] : []
  })
  // Every slide after the title, in carousel order.
  const slides: EditSlide[] = entries.flatMap((entry): EditSlide[] => {
    if (entry.kind === "photo") return [{ ...entry, story: null }]
    const story = stories.get(entry.id)
    return story ? [{ ...entry, story }] : []
  })
  const ready = (story: KitStory) => Boolean(story.cutoutUrl) || Boolean(cutoutFailed[story.row.marketingEntityId])
  const everyPiece = allPieceIds.flatMap((id) => {
    const story = stories.get(id)
    return story ? [story] : []
  })
  const waiting = everyPiece.filter((story) => !ready(story))

  const flatlayStories = (flatlayIds ?? []).flatMap((id) => {
    const story = stories.get(id)
    return story ? [story] : []
  })
  const flatlayPieces: SlidePiece[] = flatlayStories.flatMap((story) => {
    const piece = pieceById.get(story.row.marketingEntityId)
    if (!piece) return []
    return [
      {
        id: piece.id,
        slot: piece.slot,
        imageUrl: story.cutoutUrl ? story.imageUrl : null,
        brand: story.designer,
        sizeLabel: story.sizeLabel,
        priceLabel: shortPrice(story.priceLabel),
      },
    ]
  })

  /** Stock not already in the edit, newest first; "New arrivals" keeps the newest only. */
  const options: PickerOption[] = useMemo(() => {
    const pool = searchNew ? eligible.slice(0, NEW_ARRIVALS_COUNT) : eligible
    return pool.flatMap((row) => {
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
    })
  }, [eligible, searchNew, pieceIds, stories, entityId])

  /** For the flatlay: the edit's own pieces first, then the stock search. */
  const flatlayOptions: PickerOption[] = useMemo(() => {
    const onFlatlay = new Set(flatlayIds ?? [])
    const pool = searchNew ? eligible.slice(0, NEW_ARRIVALS_COUNT) : eligible
    const rows = [
      ...pieceIds.flatMap((id) => {
        const row = stories.get(id)?.row
        return row ? [row] : []
      }),
      ...pool.filter((row) => !pieceIds.includes(row.marketingEntityId)),
    ]
    return rows.flatMap((row) => {
      if (onFlatlay.has(row.marketingEntityId)) return []
      const story = stories.get(row.marketingEntityId)
      if (!story) return []
      const image = story.cutoutUrl ?? row.sourceImageUrls[0] ?? null
      const inEdit = pieceIds.includes(row.marketingEntityId)
      return [
        {
          id: row.marketingEntityId,
          brand: story.designer,
          title: row.title,
          detail: [inEdit ? "In this edit" : null, formatSizeForText(row.size), shortPrice(story.priceLabel)]
            .filter(Boolean)
            .join(" · "),
          thumb: image ? proxiedImageUrl(image, entityId) : null,
          searchText: [row.title, row.brand, row.description, row.category, row.vibe, row.size].filter(Boolean).join(" "),
        },
      ]
    })
  }, [eligible, searchNew, pieceIds, flatlayIds, stories, entityId])

  /** Add a blank flatlay slide; pieces go on it by kind. */
  function addFlatlay() {
    setFlatlayIds([])
  }

  function removeFlatlay() {
    setFlatlayIds(null)
    if (selected) setSelected(null)
  }

  function addToFlatlay(id: string) {
    const current = flatlayIds ?? []
    if (current.length >= FLATLAY_PIECES_MAX) {
      toast.message(`The flatlay takes up to ${FLATLAY_PIECES_MAX} pieces.`)
      return
    }
    setFlatlayIds([...current, id])
  }

  function removeFromFlatlay(id: string) {
    setFlatlayIds((flatlayIds ?? []).filter((row) => row !== id))
    setAdjust(id, null)
    if (selected === id) setSelected(null)
  }

  function hasRoom(): boolean {
    if (entries.length < EDIT_SLIDES_MAX) return true
    toast.message(`An edit takes up to ${EDIT_SLIDES_MAX} slides after the title.`)
    return false
  }

  function addPiece(id: string) {
    if (hasRoom()) setEntries([...entries, { kind: "piece", id }])
  }

  /** A full-bleed photo slide (a styled look or mood shot) at the end of the carousel. */
  async function addPhotoSlide(file: File | undefined) {
    if (!file || !hasRoom()) return
    setPhotoSlideBusy(true)
    try {
      const url = await uploadPhoto(await shrinkPhoto(file), entityId)
      setEntries((current) => [...current, { kind: "photo", id: `photo-${Date.now()}`, url: proxiedPhotoUrl(url, entityId) }])
    } catch {
      toast.error("Couldn't add the photo. Try another one.")
    } finally {
      setPhotoSlideBusy(false)
    }
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((entry) => entry.id !== id))
    setAdjust(id, null)
    if (selected === id) setSelected(null)
  }

  /** Move a slide earlier (-1) or later (+1) in the carousel. */
  function moveEntry(id: string, direction: -1 | 1) {
    const index = entries.findIndex((entry) => entry.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    setEntries(next)
  }

  function setAdjust(pieceId: string, next: LayerAdjust | null) {
    setAdjusts((current) => {
      const out = { ...current }
      if (next) out[pieceId] = next
      else delete out[pieceId]
      return out
    })
  }

  /** Bring the selected piece to the front (+1) or send it to the back (-1). */
  function restack(direction: 1 | -1) {
    if (!selected) return
    const levels = flatlayPieces.map((piece) => adjusts[piece.id]?.z ?? 0)
    const z = direction === 1 ? Math.max(...levels, 5) + 1 : Math.min(...levels, 0) - 1
    setAdjust(selected, { ...(adjusts[selected] ?? NO_ADJUST), z })
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    try {
      const url = await uploadPhoto(await shrinkPhoto(file), entityId)
      setTitle((current) => ({
        ...current,
        photo: proxiedPhotoUrl(url, entityId),
        photoShade: current.photoShade ?? 35,
        photoText: current.photoText ?? "light",
      }))
    } catch {
      toast.error("Couldn't add the photo. Try another one.")
    } finally {
      setPhotoBusy(false)
    }
  }

  function caption(): string {
    const lines = everyPiece.flatMap((story, index) => {
      const piece = pieceById.get(story.row.marketingEntityId)
      if (!piece) return []
      const fabric = fabrics[story.row.marketingEntityId]?.toLowerCase()
      const details = [formatSizeForText(story.row.size), fabric, shortPrice(story.priceLabel)].filter(Boolean).join(", ")
      return [`${index + 1}. ${story.designer} ${OUTFIT_SLOT_LABELS[piece.slot].toLowerCase()}${details ? ` (${details})` : ""}`]
    })
    return [
      `${editLabel}, all from our racks right now.`,
      "",
      ...lines,
      "",
      "One of each, so be quick. Shop through the link in our bio or come see them in store.",
    ].join("\n")
  }

  async function sendToStudio() {
    if (flatlayIds !== null && flatlayPieces.length === 0) {
      toast.message("The flatlay is blank. Add pieces to it, or remove it with the bin.")
      return
    }
    setSelected(null)
    setSending(true)
    try {
      // Let the selection outline clear before the slides are drawn.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      const urls: string[] = []
      for (const node of slideNodes.current.slice(0, slideCount)) {
        if (!node) continue
        const { blob } = await bakeStoryPng(node)
        urls.push(await uploadRenderedPng(blob, entityId))
      }
      if (urls.length < 2) throw new Error("Add a piece or a photo first.")
      saveStudioSlidesHandoff(entityId, { urls, caption: caption() })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't prepare the slides.")
      setSending(false)
    }
  }

  async function saveStory(key: string, filename: string) {
    const node = storyNodes.current[key]
    if (!node) return
    setSavingId(key)
    try {
      const baked = await bakeStoryPng(node)
      const result = await shareOrDownloadStory({ ...baked, filename })
      if (result === "downloaded") toast.success("Story image saved.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setSavingId(null)
    }
  }

  /** Everything a piece card shows, the same for its feed slide and its Story. */
  function cardProps(id: string, story: KitStory) {
    return {
      background: bgFor(id),
      brandName: entityName,
      editLabel,
      eyebrow: cardFields.number ? eyebrowFor(id) : null,
      editorial: title.style === "editorial",
      align: cardAlign,
      imageUrl: ready(story) ? story.imageUrl : null,
      designer: cardFields.brand ? story.designer : null,
      categoryLabel: cardFields.category ? pieceType(story.row.title, story.row.brand) : null,
      vibeLabel: cardFields.vibe ? story.vibe : null,
      sizeLabel: cardFields.size ? story.sizeLabel : null,
      fabricLabel: fabrics[id] ?? null,
      pillAlign,
      pillFill,
      pillShape,
      priceLabel: cardFields.price ? shortPrice(story.priceLabel) : null,
      wasLabel: cardFields.price && story.row.wasPrice != null ? money(story.row.wasPrice) : null,
    }
  }

  if (!isWls) {
    return (
      <div className="border-2 border-mad-black bg-white p-6 font-typewriter text-sm">
        Themed edits are only for Worn Label Society. Switch brand in the top bar.
      </div>
    )
  }

  const flatlayShown = flatlayIds !== null
  const firstItemSlide = flatlayShown ? 2 : 1
  const slideCount = firstItemSlide + slides.length
  /** Ref for the slide at this place in the carousel. */
  const slideRef = (index: number) => (node: HTMLDivElement | null) => {
    slideNodes.current[index] = node
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-mad-black pb-3">
        <div>
          <p className="font-typewriter text-[10px] uppercase tracking-widest text-mad-black/60">
            Feed carousel and Stories · {slideCount} slides, 4:5
          </p>
          <h1 className="brand-typewriter text-xl">Themed edit</h1>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            Name the edit, pick the pieces, and get a title page, a flatlay of
            the whole edit and a card for each piece. Drag pieces on the
            flatlay to move, resize or tilt them. Kept as a draft on this device.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
            className="border-2 border-mad-black bg-mad-black text-mad-white"
            disabled={slides.length === 0 || waiting.length > 0 || sending}
            onClick={() => void sendToStudio()}
            title={waiting.length > 0 ? "Waiting for cutouts" : "Open the carousel in Studio"}
          >
            {sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
            {sending ? "Preparing slides…" : "Send to Studio"}
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="edit-title" className="grid content-start gap-3">
          <h2 id="edit-title" className="font-typewriter text-xs uppercase tracking-widest">
            Title page
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Title starting points">
            {TITLE_PICKS.map((pick) => (
              <button
                key={pick}
                type="button"
                onClick={() => setTitle((current) => ({ ...current, headline: pick }))}
                aria-pressed={oneLine(title.headline) === pick}
                className={cn(
                  "border-2 border-mad-black px-2.5 py-1 text-xs",
                  oneLine(title.headline) === pick ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                )}
              >
                {pick}
              </button>
            ))}
          </div>
          <div className="flex border-2 border-mad-black self-start" role="group" aria-label="Title style">
            {(["kit", "editorial"] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setTitle((current) => ({ ...current, style }))}
                aria-pressed={(title.style ?? "kit") === style}
                className={cn(
                  "h-9 px-4 font-typewriter text-xs font-bold uppercase tracking-widest",
                  (title.style ?? "kit") === style ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                )}
              >
                {style === "kit" ? "Kit" : "Editorial"}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              Title
              <textarea
                value={title.headline}
                onChange={(event) => setTitle((current) => ({ ...current, headline: event.target.value }))}
                rows={2}
                maxLength={60}
                className="border-2 border-mad-black px-2 py-1.5 text-sm"
              />
            </label>
            <div className="grid content-start gap-2">
              <label className="grid gap-1 text-xs">
                Small line above
                <input
                  type="text"
                  value={title.kicker}
                  onChange={(event) => setTitle((current) => ({ ...current, kicker: event.target.value }))}
                  placeholder="e.g. Shop the edit"
                  maxLength={40}
                  className="h-9 border-2 border-mad-black px-2 text-sm"
                />
              </label>
              {title.style === "editorial" ? (
                <label className="grid gap-1 text-xs">
                  Script line
                  <input
                    type="text"
                    value={title.script ?? ""}
                    onChange={(event) => setTitle((current) => ({ ...current, script: event.target.value }))}
                    placeholder="e.g. see you there"
                    maxLength={40}
                    className="h-9 border-2 border-mad-black px-2 text-sm"
                  />
                </label>
              ) : (
                <label className="grid gap-1 text-xs">
                  Corner label
                  <input
                    type="text"
                    value={title.tag}
                    onChange={(event) => setTitle((current) => ({ ...current, tag: event.target.value }))}
                    placeholder="e.g. The edit"
                    maxLength={20}
                    className="h-9 border-2 border-mad-black px-2 text-sm"
                  />
                </label>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2 border-2 border-mad-black px-3 text-sm hover:bg-[#F4EFE6]",
                photoBusy && "pointer-events-none opacity-60"
              )}
              title={title.photo ? "Change the photo behind the words" : "Add a photo behind the words"}
            >
              {photoBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {title.photo ? "Change photo" : "Photo behind the words"}
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
            {title.photo ? (
              <button
                type="button"
                onClick={() => setTitle((current) => ({ ...current, photo: undefined, photoShade: undefined, photoText: undefined }))}
                title="Use the plain colour"
                aria-label="Remove the photo behind the words"
                className="flex size-9 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="edit-pieces" className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="edit-pieces" className="font-typewriter text-xs uppercase tracking-widest">
              Slides after the title · {entries.length} of {EDIT_SLIDES_MAX}
            </h2>
            {entries.length < EDIT_SLIDES_MAX ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="flex border-2 border-mad-black" role="group" aria-label="Search in">
                  {[
                    { value: true, label: "New arrivals" },
                    { value: false, label: "All stock" },
                  ].map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setSearchNew(option.value)}
                      aria-pressed={searchNew === option.value}
                      className={cn("h-7 px-2", searchNew === option.value ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <PiecePicker label="piece" options={options} onPick={addPiece} adding />
                <label
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 border-2 border-mad-black px-3 text-sm hover:bg-[#F4EFE6]",
                    photoSlideBusy && "pointer-events-none opacity-60"
                  )}
                  title="Add a full-bleed photo slide, like a styled look or mood shot"
                >
                  {photoSlideBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
                  Add a photo slide
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      void addPhotoSlide(event.target.files?.[0])
                      event.target.value = ""
                    }}
                  />
                </label>
              </div>
            ) : null}
          </div>
          {!loaded ? (
            <p className="flex items-center gap-2 text-sm text-mad-black/60">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the stock…
            </p>
          ) : entries.length === 0 ? (
            <p className="border-2 border-dashed border-mad-black/40 bg-white p-4 text-sm text-mad-black/70">
              Add pieces from the newest arrivals or all stock, and photo
              slides of your own. Each one becomes a slide and a Story.
            </p>
          ) : (
            <ol className="grid gap-1.5">
              {slides.map((slide, index) => {
                const id = slide.id
                const story = slide.story
                const name = story ? story.designer : "Photo slide"
                return (
                  <li key={id} className="flex items-center gap-2 border-2 border-mad-black bg-white px-2 py-1.5">
                    <span className="w-4 text-center font-typewriter text-xs">{index + 1}</span>
                    {slide.kind === "photo" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={slide.url} alt="" className="h-9 w-7 shrink-0 object-cover" />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{name}</span>
                      <span className="block truncate text-[11px] text-mad-black/60">
                        {story ? story.row.title : "Your photo, full bleed"}
                      </span>
                    </span>
                    {story ? (
                      <FabricPicker
                        value={fabrics[id] ?? null}
                        suggestion={listingFabric([story.row.title, story.row.description].filter(Boolean).join(" "))}
                        pieceName={story.designer}
                        onChange={(next) =>
                          setFabrics((current) => {
                            const out = { ...current }
                            if (next) out[id] = next
                            else delete out[id]
                            return out
                          })
                        }
                      />
                    ) : null}
                    {story && cardFields.number ? (
                      <input
                        type="text"
                        value={eyebrows[id] ?? ""}
                        onChange={(event) => {
                          const next = event.target.value
                          setEyebrows((current) => {
                            const out = { ...current }
                            if (next) out[id] = next
                            else delete out[id]
                            return out
                          })
                        }}
                        placeholder={`No. ${String(pieceIds.indexOf(id) + 1).padStart(2, "0")}`}
                        aria-label={`Eyebrow for ${story.designer}`}
                        title="Eyebrow: the small line above the brand. Blank uses the number."
                        maxLength={24}
                        className="h-7 w-24 shrink-0 border-2 border-mad-black px-1.5 text-[11px] uppercase tracking-wider"
                      />
                    ) : null}
                    {story && !ready(story) ? (
                      <span className="text-[11px] text-mad-black/55">{cuttingId === id ? "Cutting out…" : "Waiting"}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => moveEntry(id, -1)}
                      disabled={index === 0}
                      title="Earlier in the carousel"
                      aria-label={`Move ${name} earlier`}
                      className="flex size-7 items-center justify-center text-mad-black/60 hover:text-mad-black disabled:opacity-30"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEntry(id, 1)}
                      disabled={index === slides.length - 1}
                      title="Later in the carousel"
                      aria-label={`Move ${name} later`}
                      className="flex size-7 items-center justify-center text-mad-black/60 hover:text-mad-black disabled:opacity-30"
                    >
                      <ChevronRight className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(id)}
                      title="Take out of the edit"
                      aria-label={`Take ${name} out of the edit`}
                      className="flex size-7 items-center justify-center text-mad-black/60 hover:text-mad-black"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
          <div className="grid gap-2 border-t-2 border-mad-black/15 pt-3">
            {flatlayIds === null ? (
              <button
                type="button"
                onClick={addFlatlay}
                title="Add a flatlay of the edit as slide 2"
                className="flex h-9 items-center gap-2 self-start border-2 border-mad-black px-3 text-sm hover:bg-[#F4EFE6]"
              >
                <Plus className="size-4" aria-hidden />
                Add flatlay
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-typewriter text-xs uppercase tracking-widest">
                    Flatlay, slide 2 · {flatlayIds.length} of {FLATLAY_PIECES_MAX}
                  </h3>
                  <button
                      type="button"
                      onClick={removeFlatlay}
                      title="Remove the flatlay slide"
                      aria-label="Remove the flatlay slide"
                      className="flex size-9 items-center justify-center border-2 border-mad-black hover:bg-[#F4EFE6]"
                    >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {flatlayIds.length < FLATLAY_PIECES_MAX ? (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Add to the flatlay">
                    {FLATLAY_KINDS.map((kind) => (
                      <PiecePicker
                        key={kind.label}
                        label={kind.label.toLowerCase()}
                        addText={kind.label}
                        options={flatlayOptions.filter((option) => {
                          const slot = pieceById.get(option.id)?.slot
                          return slot != null && kind.slots.includes(slot)
                        })}
                        onPick={addToFlatlay}
                        adding
                        quiet
                      />
                    ))}
                  </div>
                ) : null}
                {flatlayStories.length === 0 ? (
                  <p className="text-xs text-mad-black/60">
                    Blank for now. Add a top, bottom, dress, layer, accessory or footwear, from the edit or from stock.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {flatlayStories.map((story) => {
                      const id = story.row.marketingEntityId
                      const image = story.cutoutUrl ?? story.row.sourceImageUrls[0] ?? null
                      return (
                        <li key={id} className="flex items-center gap-1.5 border-2 border-mad-black bg-white py-1 pl-1 pr-0.5">
                          <span className="h-8 w-7 shrink-0 bg-neutral-100">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={proxiedImageUrl(image, entityId)} alt="" className="size-full object-contain" />
                            ) : null}
                          </span>
                          <span className="max-w-[7rem] truncate text-xs">{story.designer}</span>
                          <button
                            type="button"
                            onClick={() => removeFromFlatlay(id)}
                            title="Take off the flatlay"
                            aria-label={`Take ${story.designer} off the flatlay`}
                            className="flex size-6 items-center justify-center text-mad-black/60 hover:text-mad-black"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="edit-carousel" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="edit-carousel" className="font-typewriter text-xs uppercase tracking-widest">
            Feed carousel · {slideCount} slides
          </h2>
          {selected ? (
            <div className="flex items-center gap-1.5">
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
            </div>
          ) : null}
        </div>

        {/* Card style: one panel for colour, words, what shows and the fabric pill. Stays in view while scrolling the cards. */}
        <div
          role="group"
          aria-label="Card style"
          className="sticky top-0 z-20 grid gap-x-8 gap-y-3 border-2 border-mad-black bg-white p-3 md:grid-cols-2"
        >
          <StyleRow label="Colour">
            <div className="flex items-center gap-1.5" role="group" aria-label="Background">
              {kit.map((bg) => {
                const current = (pickedCard ? bgFor(pickedCard) : background).id === bg.id
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() =>
                      pickedCard
                        ? setCardBackgrounds((now) => ({ ...now, [pickedCard]: bg.id }))
                        : setBackgroundId(bg.id)
                    }
                    title={bg.name}
                    aria-label={pickedCard ? `Use ${bg.name} for the picked card` : `Use ${bg.name} for the edit`}
                    aria-pressed={current}
                    className={cn(
                      "relative size-7 rounded-full border border-black/15",
                      current && "ring-2 ring-mad-black ring-offset-2"
                    )}
                    style={{ background: bg.color }}
                  >
                    {current ? (
                      <Check className="absolute inset-0 m-auto size-3.5" style={{ color: bg.text_color }} aria-hidden />
                    ) : null}
                  </button>
                )
              })}
            </div>
            {pickedCard ? (
              <span className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-mad-vermillion px-2 py-0.5 text-white">{cardName(pickedCard)} card</span>
                {cardBackgrounds[pickedCard] ? (
                  <button
                    type="button"
                    onClick={() =>
                      setCardBackgrounds((now) => {
                        const out = { ...now }
                        delete out[pickedCard]
                        return out
                      })
                    }
                    className="underline"
                  >
                    Same as the rest
                  </button>
                ) : null}
                <button type="button" onClick={() => setPickedCard(null)} className="font-medium underline">
                  Done
                </button>
              </span>
            ) : (
              <span className="text-xs text-mad-black/55">All cards. Click a card to colour just that one.</span>
            )}
          </StyleRow>

          <StyleRow label="Words">
            <AlignButtons value={cardAlign} onChange={setCardAlign} what="the words" />
          </StyleRow>

          <StyleRow label="Show" wide>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="On the piece cards">
              {CARD_FIELDS.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => setCardFields((now) => ({ ...now, [field.id]: !now[field.id] }))}
                  aria-pressed={cardFields[field.id]}
                  title={cardFields[field.id] ? `Hide ${field.label.toLowerCase()} on the cards` : `Show ${field.label.toLowerCase()} on the cards`}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-full border-2 border-mad-black px-2.5 text-[11px] uppercase tracking-wider",
                    cardFields[field.id] ? "bg-mad-black text-mad-white" : "border-dashed text-mad-black/70 hover:bg-[#F4EFE6]"
                  )}
                >
                  {cardFields[field.id] ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
                  {field.label}
                </button>
              ))}
            </div>
          </StyleRow>

          <StyleRow label="Fabric pill" wide>
            <AlignButtons value={pillAlign} onChange={setPillAlign} what="the fabric pill" />
            <div className="flex items-center gap-1" role="group" aria-label="Pill colour">
              {PILL_FILLS.map((fill) => {
                const look =
                  fill.id === "outline"
                    ? { background: "transparent", borderColor: background.text_color }
                    : fill.id === "accent"
                      ? { background: background.accent_color, borderColor: background.accent_color }
                      : fill.id === "ink"
                        ? { background: background.text_color, borderColor: background.text_color }
                        : { background: "#F4F1EA", borderColor: "#F4F1EA" }
                return (
                  <button
                    key={fill.id}
                    type="button"
                    onClick={() => setPillFill(fill.id)}
                    aria-pressed={pillFill === fill.id}
                    title={`${fill.label} pill`}
                    aria-label={`${fill.label} pill`}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full",
                      pillFill === fill.id && "ring-2 ring-mad-black ring-offset-1"
                    )}
                    style={{ background: background.color }}
                  >
                    <span className="block h-3 w-5 rounded-full border-2" style={look} />
                  </button>
                )
              })}
            </div>
            <div className="flex border-2 border-mad-black" role="group" aria-label="Pill shape">
              {PILL_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() => setPillShape(shape.id)}
                  aria-pressed={pillShape === shape.id}
                  title={`${shape.label} pill`}
                  aria-label={`${shape.label} pill`}
                  className={cn(
                    "flex h-7 w-9 items-center justify-center",
                    pillShape === shape.id ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]"
                  )}
                >
                  <span
                    aria-hidden
                    className="block h-3 w-5 border-2 border-current"
                    style={{ borderRadius: shape.id === "round" ? 999 : shape.id === "soft" ? 3 : 0 }}
                  />
                </button>
              ))}
            </div>
          </StyleRow>
        </div>
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <li className="min-w-0">
            <div {...pickable("title", "title page")}>
              <AnnouncementCard ref={slideRef(0)} background={bgFor("title")} brandName={entityName} announcement={title} className="rounded-sm shadow-md" />
            </div>
          </li>
          {flatlayShown ? (
            <li className="min-w-0">
              <div {...pickable("flatlay", "flatlay")}>
              <OutfitSlide
                ref={slideRef(1)}
                background={bgFor("flatlay")}
                brandName={entityName}
                day={editLabel}
                vibe={title.kicker.trim() || "The edit"}
                pieces={flatlayPieces}
                adjust={adjusts}
                onAdjust={(pieceId, next) => setAdjust(pieceId, next)}
                selectedId={selected}
                onSelect={setSelected}
                className="rounded-sm shadow-md"
              />
              </div>
            </li>
          ) : null}
          {slides.map((slide, index) => (
            <li key={slide.id} className="min-w-0">
              {slide.story ? (
                <div {...pickable(slide.id, slide.story.designer)}>
                  <EditItemSlide
                    ref={slideRef(firstItemSlide + index)}
                    {...cardProps(slide.id, slide.story)}
                    className="rounded-sm shadow-md"
                  />
                </div>
              ) : slide.kind === "photo" ? (
                <EditPhotoSlide
                  ref={slideRef(firstItemSlide + index)}
                  background={background}
                  brandName={entityName}
                  photoUrl={slide.url}
                  className="rounded-sm shadow-md"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="edit-stories" className="grid gap-3">
        <h2 id="edit-stories" className="font-typewriter text-xs uppercase tracking-widest">
          Stories · post them in this order
        </h2>
        <ul className="flex snap-x gap-4 overflow-x-auto pb-2">
          <li className="flex w-[200px] shrink-0 snap-start flex-col gap-2">
            <div {...pickable("title", "title page")}>
            <div className="overflow-hidden rounded-md shadow-md">
              <AnnouncementStory
                ref={(node) => {
                  storyNodes.current.title = node
                }}
                background={bgFor("title")}
                brandName={entityName}
                announcement={title}
              />
            </div>
            </div>
            <button
              type="button"
              onClick={() => void saveStory("title", "wls-edit-title.png")}
              disabled={savingId != null}
              className="flex h-8 items-center justify-center gap-1.5 bg-mad-black text-xs text-mad-white disabled:opacity-40"
            >
              {savingId === "title" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
              Story 1
            </button>
          </li>
          {slides.map((slide, index) => {
            const id = slide.id
            const story = slide.story
            if (!story) {
              if (slide.kind !== "photo") return null
              return (
                <li key={id} className="flex w-[200px] shrink-0 snap-start flex-col gap-2">
                  <div className="overflow-hidden rounded-md shadow-md">
                    <EditPhotoSlide
                      ref={(node) => {
                        storyNodes.current[id] = node
                      }}
                      background={background}
                      brandName={entityName}
                      photoUrl={slide.url}
                      story
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveStory(id, `wls-edit-photo-${index + 2}.png`)}
                    disabled={savingId != null}
                    className="flex h-8 items-center justify-center gap-1.5 bg-mad-black text-xs text-mad-white disabled:opacity-40"
                  >
                    {savingId === id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
                    Story {index + 2}
                  </button>
                </li>
              )
            }
            return (
              <li key={id} className="flex w-[200px] shrink-0 snap-start flex-col gap-2">
                <div {...pickable(id, story.designer)}>
                  <div className="overflow-hidden rounded-md shadow-md">
                    <EditItemSlide
                      ref={(node) => {
                        storyNodes.current[id] = node
                      }}
                      {...cardProps(id, story)}
                      story
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void saveStory(id, `wls-edit-${story.row.websiteItemId}.png`)}
                  disabled={!ready(story) || savingId != null}
                  className="flex h-8 items-center justify-center gap-1.5 bg-mad-black text-xs text-mad-white disabled:opacity-40"
                >
                  {savingId === id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Share2 className="size-3.5" aria-hidden />}
                  Story {index + 2}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
