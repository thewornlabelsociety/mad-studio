/**
 * The coloured dot on a Worn Label tag ("Black", "Yellow" …), from the
 * website's `dotColour`. Stored on the synced row so templates can find this
 * week's dot special pieces.
 */

export const WLS_DOT_COLOURS = [
  "Black",
  "Pink",
  "Orange",
  "Yellow",
  "Blue",
  "Green",
  "Red",
  "Purple",
] as const

export type WlsDotColour = (typeof WLS_DOT_COLOURS)[number]

/** "black", " BLACK " → "Black"; anything else → null. */
export function normalizeDotColour(value: unknown): WlsDotColour | null {
  if (typeof value !== "string") return null
  const clean = value.trim().toLowerCase()
  return WLS_DOT_COLOURS.find((colour) => colour.toLowerCase() === clean) ?? null
}

export function readListingDotFromMetrics(metrics: unknown): WlsDotColour | null {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null
  return normalizeDotColour((metrics as Record<string, unknown>).listing_dot_colour)
}

/** Sets or clears the dot; `undefined` (a feed without dots) leaves it alone. */
export function withListingDotMetrics(
  metrics: Record<string, unknown>,
  dotColour: string | null | undefined
): Record<string, unknown> {
  if (dotColour === undefined) return metrics
  const next = { ...metrics }
  const colour = normalizeDotColour(dotColour)
  if (colour) next.listing_dot_colour = colour
  else delete next.listing_dot_colour
  return next
}
