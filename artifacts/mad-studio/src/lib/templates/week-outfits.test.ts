import assert from "node:assert/strict"
import { test } from "node:test"

import { garmentSlot } from "../inventory/listing-garment.ts"
import {
  addableSlots,
  addPiece,
  buildWeekOutfits,
  nextSwap,
  nextWeekRange,
  toOutfitPiece,
  type OutfitPiece,
} from "./week-outfits.ts"

const row = (id: string, title: string, extra: Partial<Parameters<typeof toOutfitPiece>[0]> = {}) =>
  toOutfitPiece({ marketingEntityId: id, title, brand: null, ...extra })

test("garment slot reads the title before the category, without the brand", () => {
  assert.equal(garmentSlot({ title: "Vest Just Jeans in Navy", brand: "Just Jeans", category: "Tops" }), "top")
  assert.equal(garmentSlot({ title: "Board Shorts Blank Canvas", category: "Menswear" }), "bottom")
  assert.equal(garmentSlot({ title: "Linen Midi Dress Zimmermann" }), "dress")
  assert.equal(garmentSlot({ title: "Something", category: "Bottoms" }), "bottom")
  assert.equal(garmentSlot({ title: "Leather Tote" }), "accessory")
})

test("seven days, each around a different top, with bottoms shared out", () => {
  const pieces: OutfitPiece[] = [
    ...Array.from({ length: 8 }, (_, i) => row(`t${i}`, `Shirt ${i}`, { gender: "men" })),
    row("b1", "Board Shorts A", { gender: "men" }),
    row("b2", "Shorts B", { gender: "men" }),
  ]
  const week = buildWeekOutfits(pieces)
  assert.equal(week.length, 7)
  const tops = week.map((day) => day.pieceIds.find((id) => id.startsWith("t")))
  assert.equal(new Set(tops).size, 7)
  const bottomUses = week.flatMap((day) => day.pieceIds.filter((id) => id.startsWith("b")))
  assert.equal(bottomUses.filter((id) => id === "b1").length, 4)
  assert.equal(bottomUses.filter((id) => id === "b2").length, 3)
})

test("men's and women's pieces never share an outfit", () => {
  const pieces = [
    row("tm", "Shirt Mens", { gender: "men" }),
    row("tw", "Blouse", { gender: "women" }),
    row("bw", "Tailored Shorts", { gender: "women" }),
    row("bm", "Board Shorts", { gender: "men" }),
  ]
  const week = buildWeekOutfits(pieces)
  assert.deepEqual(week[0].pieceIds, ["tm", "bm"])
  assert.deepEqual(week[1].pieceIds, ["tw", "bw"])
})

test("pieces sit in slide order and matching vibe wins a tie", () => {
  const pieces = [
    row("t", "Shirt", { vibe: "Surf Street" }),
    row("b1", "Jeans", { vibe: "Preppy" }),
    row("b2", "Shorts", { vibe: "Surf Street" }),
    row("s", "Sneakers"),
    row("j", "Denim Jacket"),
  ]
  const [monday, tuesday] = buildWeekOutfits(pieces)
  assert.deepEqual(monday.pieceIds, ["t", "b2", "s"])
  // Tuesday adds a layer.
  assert.equal(tuesday.pieceIds[0], "j")
})

test("swap moves to the next wearable piece of the same kind", () => {
  const pieces = [
    row("t1", "Shirt", { gender: "men" }),
    row("t2", "Blouse", { gender: "women" }),
    row("t3", "Tee", { gender: "men" }),
    row("b", "Shorts", { gender: "men" }),
    row("d", "Dress", { gender: "women" }),
  ]
  assert.equal(nextSwap({ pieces, outfit: ["t1", "b"], currentId: "t1" }), "t3")
  assert.equal(nextSwap({ pieces, outfit: ["t3", "b"], currentId: "t3" }), "t1")
  assert.equal(nextSwap({ pieces, outfit: ["t1", "b"], currentId: "b" }), null)
})

test("add offers only slots stock can fill", () => {
  const pieces = [row("t", "Shirt"), row("b", "Shorts"), row("s", "Boots")]
  assert.deepEqual(addableSlots({ pieces, outfit: ["t"] }), ["bottom", "shoes"])
  assert.deepEqual(addPiece({ pieces, outfit: ["t"], slot: "shoes" }), ["t", "s"])
})

test("week starts next Monday, or today when today is Monday", () => {
  const thursday = new Date(2026, 9, 29)
  assert.equal(nextWeekRange(thursday).start.getDate(), 2)
  assert.equal(nextWeekRange(thursday).end.getDate(), 8)
  const monday = new Date(2026, 10, 2)
  assert.equal(nextWeekRange(monday).start.getDate(), 2)
})
