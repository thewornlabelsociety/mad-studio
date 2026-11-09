import type { GarmentSlot } from "../inventory/listing-garment.ts"
import { sortBySlot, wearsWith, type OutfitPiece } from "./week-outfits.ts"

export const THREE_WAYS_LOOKS = 3

/** Starting names for the three looks; every one stays editable. */
export const LOOK_NAME_PICKS: string[][] = [
  ["Day", "Work", "Night"],
  ["Casual", "Smart", "Going out"],
  ["Weekend", "Office", "Dinner"],
]

/**
 * Three outfits around one piece. The piece is in every look; everything
 * else is shared out so each look wears it differently (the least-worn piece
 * first, then one with the same vibe). A top or bottom takes its other half,
 * a dress stands alone, and a layer, shoes or accessory goes over a top and
 * bottom or a dress, alternating when both are in stock.
 */
export function buildThreeWays(pieces: OutfitPiece[], heroId: string): string[][] {
  const hero = pieces.find((piece) => piece.id === heroId)
  if (!hero) return []
  const byId = new Map(pieces.map((piece) => [piece.id, piece]))
  const order = new Map(pieces.map((piece, index) => [piece.id, index]))
  const uses = new Map<string, number>()

  function pick(slot: GarmentSlot, look: OutfitPiece[]): OutfitPiece | null {
    const candidates = pieces.filter(
      (piece) =>
        piece.slot === slot &&
        piece.id !== hero!.id &&
        !look.some((other) => other.id === piece.id) &&
        look.every((other) => wearsWith(piece.gender, other.gender))
    )
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
      const used = (uses.get(a.id) ?? 0) - (uses.get(b.id) ?? 0)
      if (used !== 0) return used
      const vibeA = hero!.vibe && a.vibe === hero!.vibe ? 0 : 1
      const vibeB = hero!.vibe && b.vibe === hero!.vibe ? 0 : 1
      if (vibeA !== vibeB) return vibeA - vibeB
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
    return candidates[0]
  }

  function add(look: OutfitPiece[], slot: GarmentSlot): boolean {
    const piece = pick(slot, look)
    if (piece) look.push(piece)
    return Boolean(piece)
  }

  return Array.from({ length: THREE_WAYS_LOOKS }, (_, index) => {
    const look: OutfitPiece[] = [hero]
    if (hero.slot === "top") add(look, "bottom")
    else if (hero.slot === "bottom") add(look, "top")
    else if (hero.slot !== "dress") {
      // The piece goes over something: a dress on the middle look when there is one.
      const dressFirst = index === 1
      if (!(dressFirst && add(look, "dress"))) {
        const top = add(look, "top")
        const bottom = add(look, "bottom")
        if (!top && !bottom) add(look, "dress")
      }
    }
    // A layer on the middle and last looks, so they don't all read the same.
    if (hero.slot !== "outerwear" && index > 0) add(look, "outerwear")
    if (hero.slot !== "shoes") add(look, "shoes")
    if (hero.slot !== "accessory") add(look, "accessory")
    for (const piece of look) if (piece.id !== hero.id) uses.set(piece.id, (uses.get(piece.id) ?? 0) + 1)
    return sortBySlot(look.map((piece) => piece.id), byId)
  })
}
