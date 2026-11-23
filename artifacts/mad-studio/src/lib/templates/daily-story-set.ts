/**
 * The daily Story set: today's hours, new arrivals grouped by vibe, the
 * week's dot specials, then pieces at 25% and 50% off. The picking rules
 * live here with no imports, so they can be tested on their own.
 */

export type SetPiece = {
  id: string
  wasPrice?: number | null
  price: number | null
  discountedAt?: string | null
  storySharedAt?: string | null
}

/** Whole-number percent off, e.g. was 40, now 30 gives 25. */
export function percentOffOf(was: number, now: number): number {
  if (!(was > 0) || now >= was) return 0
  return Math.round(((was - now) / was) * 100)
}

/** The newest new arrivals not yet in a Story: not marked down, never shared. */
export function pickArrivals<T extends SetPiece>(rows: T[], count = 10): T[] {
  return rows.filter((row) => row.wasPrice == null && !row.storySharedAt).slice(0, count)
}

/**
 * Pieces that share a vibe sit next to each other, the vibes in the order
 * they first appear, so the Stories flow by look rather than at random.
 */
export function groupByVibe<T>(items: T[], vibeOf: (item: T) => string | null | undefined): T[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const vibe = (vibeOf(item) ?? "").trim().toLowerCase()
    groups.set(vibe, [...(groups.get(vibe) ?? []), item])
  }
  return [...groups.values()].flat()
}

/**
 * Up to `perBucket` marked-down pieces at about 25% off and about 50% off,
 * newest markdowns first. "About" allows for prices rounded in the shop:
 * 15–37% counts as 25% off, 38–65% as 50% off.
 */
export function pickSale<T extends SetPiece>(rows: T[], perBucket = 5): { quarter: T[]; half: T[] } {
  const marked = rows
    .filter((row) => row.wasPrice != null && row.price != null)
    .sort((a, b) => (b.discountedAt ?? "").localeCompare(a.discountedAt ?? ""))
  const off = (row: T) => percentOffOf(row.wasPrice!, row.price!)
  return {
    quarter: marked.filter((row) => off(row) >= 15 && off(row) <= 37).slice(0, perBucket),
    half: marked.filter((row) => off(row) >= 38 && off(row) <= 65).slice(0, perBucket),
  }
}

/** Instagram takes up to 10 Story frames per post, so a long set goes up in batches. */
export function chunkFrames<T>(frames: T[], size = 10): T[][] {
  const out: T[][] = []
  for (let i = 0; i < frames.length; i += size) out.push(frames.slice(i, i + size))
  return out
}

/**
 * When the set goes up: at `hour` today, or if that has passed, at the next
 * 5 minutes (at least 5 minutes away).
 */
export function setPostTime(now: Date, hour = 8): Date {
  const planned = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0)
  if (planned.getTime() > now.getTime() + 5 * 60 * 1000) return planned
  const next = new Date(now.getTime() + 5 * 60 * 1000)
  next.setSeconds(0, 0)
  next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5)
  return next
}
