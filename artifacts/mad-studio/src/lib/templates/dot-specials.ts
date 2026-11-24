/** What the dot special takes off: a percentage, or dollars off each piece. */
export type DotDiscount = { kind: "percent"; value: number } | { kind: "amount"; value: number }

/**
 * Reads the discount as typed on the dot special: "25% off", "25%",
 * "half price", "$10 off". Null when there's no number to work from.
 */
export function parseDotDiscount(text: string): DotDiscount | null {
  const clean = text.trim().toLowerCase()
  if (!clean) return null
  if (/\bhalf\b/.test(clean)) return { kind: "percent", value: 50 }
  const percent = clean.match(/(\d+(?:\.\d+)?)\s*%/)
  if (percent) {
    const value = Number(percent[1])
    return value > 0 && value < 100 ? { kind: "percent", value } : null
  }
  const amount = clean.match(/\$\s*(\d+(?:\.\d+)?)/)
  if (amount) {
    const value = Number(amount[1])
    return value > 0 ? { kind: "amount", value } : null
  }
  return null
}

/**
 * A percentage dot special reads "up to": designer and brand new with tags pieces stop
 * at 25% off (designer 15% then 25%), so not every piece in the colour takes the full amount.
 * "50% off" -> { upTo: true, amount: "50% off" }. Dollars off, or text that already says
 * "up to", is left as typed.
 */
export function dotDiscountWording(text: string): { upTo: boolean; amount: string } {
  const amount = text.trim()
  if (!amount) return { upTo: false, amount }
  if (/\bup\s*to\b/i.test(amount)) return { upTo: false, amount }
  return { upTo: parseDotDiscount(amount)?.kind === "percent", amount }
}

/** The discount as one line for captions and labels, e.g. "up to 50% off". */
export function dotDiscountLine(text: string): string {
  const { upTo, amount } = dotDiscountWording(text)
  return upTo ? `up to ${amount}` : amount
}

/** The special price, to the cent; never below zero. */
export function specialPrice(price: number, discount: DotDiscount): number {
  const off = discount.kind === "percent" ? (price * discount.value) / 100 : discount.value
  return Math.max(0, Math.round((price - off) * 100) / 100)
}
