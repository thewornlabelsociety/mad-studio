import assert from "node:assert/strict"
import { test } from "node:test"

import { buildThreeWays } from "./three-ways.ts"
import { toOutfitPiece } from "./week-outfits.ts"

const row = (id: string, title: string, extra: Partial<Parameters<typeof toOutfitPiece>[0]> = {}) =>
  toOutfitPiece({ marketingEntityId: id, title, brand: null, ...extra })

test("the piece is in all three looks, each with a different bottom", () => {
  const pieces = [
    row("hero", "Silk Shirt", { gender: "women" }),
    row("b1", "Wide Leg Pants", { gender: "women" }),
    row("b2", "Denim Skirt", { gender: "women" }),
    row("b3", "Tailored Shorts", { gender: "women" }),
    row("s1", "Leather Boots", { gender: "women" }),
  ]
  const looks = buildThreeWays(pieces, "hero")
  assert.equal(looks.length, 3)
  assert.ok(looks.every((look) => look.includes("hero")))
  const bottoms = looks.map((look) => look.find((id) => id.startsWith("b")))
  assert.equal(new Set(bottoms).size, 3)
  assert.ok(looks.every((look) => look.includes("s1")))
})

test("a dress stands alone and gets a layer after the first look", () => {
  const pieces = [
    row("hero", "Linen Midi Dress", { gender: "women" }),
    row("b1", "Wide Leg Pants", { gender: "women" }),
    row("o1", "Wool Blazer", { gender: "women" }),
  ]
  const looks = buildThreeWays(pieces, "hero")
  assert.ok(looks.every((look) => !look.includes("b1")))
  assert.deepEqual(looks.map((look) => look.includes("o1")), [false, true, true])
})

test("a layer goes over a top and bottom, and a dress on the middle look", () => {
  const pieces = [
    row("hero", "Wool Blazer", { gender: "women" }),
    row("t1", "Silk Shirt", { gender: "women" }),
    row("b1", "Wide Leg Pants", { gender: "women" }),
    row("d1", "Slip Dress", { gender: "women" }),
  ]
  const looks = buildThreeWays(pieces, "hero")
  assert.ok(looks[0].includes("t1") && looks[0].includes("b1"))
  assert.ok(looks[1].includes("d1") && !looks[1].includes("b1"))
})

test("men's and women's pieces never share a look; an unknown piece gives nothing", () => {
  const pieces = [
    row("hero", "Oxford Shirt", { gender: "men" }),
    row("b1", "Chinos", { gender: "women" }),
  ]
  assert.deepEqual(buildThreeWays(pieces, "hero"), [["hero"], ["hero"], ["hero"]])
  assert.deepEqual(buildThreeWays(pieces, "missing"), [])
})
