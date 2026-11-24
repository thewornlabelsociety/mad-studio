import assert from "node:assert/strict"
import { test } from "node:test"

import { dotDiscountLine, dotDiscountWording, parseDotDiscount, specialPrice } from "./dot-specials.ts"

test("reads percentages, half price and dollars off", () => {
  assert.deepEqual(parseDotDiscount("25% off"), { kind: "percent", value: 25 })
  assert.deepEqual(parseDotDiscount(" 50 %"), { kind: "percent", value: 50 })
  assert.deepEqual(parseDotDiscount("Half price"), { kind: "percent", value: 50 })
  assert.deepEqual(parseDotDiscount("$10 off"), { kind: "amount", value: 10 })
})

test("no usable number gives null", () => {
  assert.equal(parseDotDiscount(""), null)
  assert.equal(parseDotDiscount("Buy one get one"), null)
  assert.equal(parseDotDiscount("100% off"), null)
  assert.equal(parseDotDiscount("0%"), null)
})

test("special price rounds to the cent and stops at zero", () => {
  assert.equal(specialPrice(45, { kind: "percent", value: 25 }), 33.75)
  assert.equal(specialPrice(39.99, { kind: "percent", value: 30 }), 27.99)
  assert.equal(specialPrice(120, { kind: "amount", value: 20 }), 100)
  assert.equal(specialPrice(8, { kind: "amount", value: 10 }), 0)
})

test("percentage dot specials read up to", () => {
  assert.deepEqual(dotDiscountWording("50% off"), { upTo: true, amount: "50% off" })
  assert.equal(dotDiscountLine("25% off"), "up to 25% off")
  assert.equal(dotDiscountLine("Up to 25% off"), "Up to 25% off")
  assert.equal(dotDiscountLine("$10 off"), "$10 off")
  assert.equal(dotDiscountLine(""), "")
})
