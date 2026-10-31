import {
  garmentGender,
  garmentSlot,
  type GarmentGender,
  type GarmentSlot,
} from "../inventory/listing-garment.ts"

export const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

/** Order pieces sit in on a slide and in its list. */
export const OUTFIT_SLOT_ORDER: GarmentSlot[] = [
  "outerwear",
  "top",
  "dress",
  "bottom",
  "shoes",
  "accessory",
  "other",
]

export const OUTFIT_SLOT_LABELS: Record<GarmentSlot, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  outerwear: "Layer",
  shoes: "Shoes",
  accessory: "Accessory",
  other: "Piece",
}

export type OutfitPiece = {
  id: string
  slot: GarmentSlot
  gender: GarmentGender | null
  vibe: string | null
}

export type DayOutfit = {
  day: (typeof WEEK_DAYS)[number]
  pieceIds: string[]
}

export function toOutfitPiece(row: {
  marketingEntityId: string
  title: string
  brand: string | null
  description?: string | null
  vibe?: string | null
  category?: string | null
  gender?: GarmentGender | null
}): OutfitPiece {
  return {
    id: row.marketingEntityId,
    slot: garmentSlot({ title: row.title, brand: row.brand, category: row.category }),
    gender: garmentGender({
      gender: row.gender,
      title: row.title,
      category: row.category,
      description: row.description,
    }),
    vibe: row.vibe?.trim() || null,
  }
}

/** Pieces of different genders never share an outfit; unknown or unisex goes with either. */
export function wearsWith(a: GarmentGender | null, b: GarmentGender | null): boolean {
  return a == null || b == null || a === "unisex" || b === "unisex" || a === b
}

function sortBySlot(ids: string[], byId: Map<string, OutfitPiece>): string[] {
  return [...ids].sort(
    (a, b) =>
      OUTFIT_SLOT_ORDER.indexOf(byId.get(a)?.slot ?? "other") -
      OUTFIT_SLOT_ORDER.indexOf(byId.get(b)?.slot ?? "other")
  )
}

/**
 * Seven outfits from live stock. Each day is built around a different top or
 * dress; bottoms, layers, shoes and accessories are shared out evenly (stock
 * is often short of bottoms, so they get re-worn), preferring a matching vibe.
 */
export function buildWeekOutfits(pieces: OutfitPiece[]): DayOutfit[] {
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  const uses = new Map<string, number>()
  const order = new Map(pieces.map((piece, index) => [piece.id, index]))
  const anchors = pieces.filter((piece) => piece.slot === "top" || piece.slot === "dress")
  const fallbackAnchors = anchors.length > 0 ? anchors : pieces.filter((piece) => piece.slot !== "other")

  function pick(slot: GarmentSlot, anchor: OutfitPiece): OutfitPiece | null {
    const candidates = pieces.filter(
      (piece) => piece.slot === slot && wearsWith(piece.gender, anchor.gender)
    )
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
      const used = (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0)
      if (used !== 0) return used
      const vibeA = anchor.vibe && a.vibe === anchor.vibe ? 0 : 1
      const vibeB = anchor.vibe && b.vibe === anchor.vibe ? 0 : 1
      if (vibeA !== vibeB) return vibeA - vibeB
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
    return candidates[0]
  }

  return WEEK_DAYS.map((day, index) => {
    const anchor = fallbackAnchors[index % Math.max(fallbackAnchors.length, 1)]
    if (!anchor) return { day, pieceIds: [] }
    const chosen = [anchor]
    if (anchor.slot === "top") {
      const bottom = pick("bottom", anchor)
      if (bottom) chosen.push(bottom)
    }
    // A layer every other day keeps the week from looking samey.
    if (index % 2 === 1) {
      const layer = pick("outerwear", anchor)
      if (layer && layer.id !== anchor.id) chosen.push(layer)
    }
    for (const slot of ["shoes", "accessory"] as const) {
      const piece = pick(slot, anchor)
      if (piece) chosen.push(piece)
    }
    for (const piece of chosen) uses.set(piece.id, (uses.get(piece.id) ?? 0) + 1)
    return { day, pieceIds: sortBySlot(chosen.map((piece) => piece.id), byId) }
  })
}

/**
 * Every piece that could replace `currentId` in this outfit: same kind
 * (a top or a dress for either), wearable with the rest, not already in it.
 * In stock order.
 */
export function swapCandidates(input: {
  pieces: OutfitPiece[]
  outfit: string[]
  currentId: string
}): OutfitPiece[] {
  const byId = new Map(input.pieces.map((piece) => [piece.id, piece]))
  const current = byId.get(input.currentId)
  if (!current) return []
  const others = input.outfit
    .filter((id) => id !== input.currentId)
    .map((id) => byId.get(id))
    .filter((piece): piece is OutfitPiece => Boolean(piece))
  const swappableSlots: GarmentSlot[] =
    current.slot === "top" || current.slot === "dress" ? ["top", "dress"] : [current.slot]
  return input.pieces.filter(
    (piece) =>
      swappableSlots.includes(piece.slot) &&
      !input.outfit.includes(piece.id) &&
      others.every((other) => wearsWith(piece.gender, other.gender)) &&
      // A dress replaces a top only when there's no bottom to clash with.
      !(piece.slot === "dress" && others.some((other) => other.slot === "bottom"))
  )
}

/** The next swap after `currentId` in stock order, wrapping round. */
export function nextSwap(input: {
  pieces: OutfitPiece[]
  outfit: string[]
  currentId: string
}): string | null {
  const candidates = swapCandidates(input)
  if (candidates.length === 0) return null
  const start = input.pieces.findIndex((piece) => piece.id === input.currentId)
  const after = candidates.find(
    (piece) => input.pieces.findIndex((row) => row.id === piece.id) > start
  )
  return (after ?? candidates[0]).id
}

/** Pieces whose words match every term of `query` (colour, brand, type…). */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = text.toLowerCase()
  return query
    .toLowerCase()
    .split(/s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term))
}

/** Slots that could still be added to an outfit from stock. */
export function addableSlots(input: { pieces: OutfitPiece[]; outfit: string[] }): GarmentSlot[] {
  const byId = new Map(input.pieces.map((piece) => [piece.id, piece]))
  const inOutfit = input.outfit
    .map((id) => byId.get(id))
    .filter((piece): piece is OutfitPiece => Boolean(piece))
  const has = new Set(inOutfit.map((piece) => piece.slot))
  const hasDress = has.has("dress")
  return (["outerwear", "bottom", "shoes", "accessory"] as GarmentSlot[]).filter((slot) => {
    if (has.has(slot)) return false
    if (slot === "bottom" && hasDress) return false
    return input.pieces.some(
      (piece) =>
        piece.slot === slot &&
        inOutfit.every((other) => wearsWith(piece.gender, other.gender))
    )
  })
}

/** Add the first wearable piece of `slot` to an outfit, kept in slide order. */
export function addPiece(input: {
  pieces: OutfitPiece[]
  outfit: string[]
  slot: GarmentSlot
}): string[] {
  const byId = new Map(input.pieces.map((piece) => [piece.id, piece]))
  const inOutfit = input.outfit
    .map((id) => byId.get(id))
    .filter((piece): piece is OutfitPiece => Boolean(piece))
  const piece = input.pieces.find(
    (row) =>
      row.slot === input.slot &&
      !input.outfit.includes(row.id) &&
      inOutfit.every((other) => wearsWith(row.gender, other.gender))
  )
  if (!piece) return input.outfit
  return sortBySlot([...input.outfit, piece.id], byId)
}

/** Monday of next week (or this Monday when today is Monday), and the Sunday after. */
export function nextWeekRange(today = new Date()): { start: Date; end: Date } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const day = start.getDay()
  const untilMonday = day === 1 ? 0 : (8 - day) % 7
  start.setDate(start.getDate() + untilMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

export function formatWeekRange(range: { start: Date; end: Date }): string {
  const format = (date: Date) =>
    date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" }).toUpperCase()
  return `${format(range.start)} – ${format(range.end)}`
}
