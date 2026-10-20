import type { MarketingEntity } from "@/lib/inventory/types"
import { detectMediaKindFromUrl } from "@/lib/media/kind"
import { getPostReadiness, type ReadinessCheckId } from "@/lib/inventory/post-readiness"

/**
 * The Brain team's rule-based roles. They only read real items — no AI, no
 * generated images — and explain every suggestion.
 */

export type MerchandiserFinding = {
  item: MarketingEntity
  missing: Array<{ id: ReadinessCheckId; label: string }>
}

export type MerchandiserReport = {
  checked: number
  ready: number
  findings: MerchandiserFinding[]
  /** How many items are missing each detail, most common first. */
  gaps: Array<{ id: ReadinessCheckId; label: string; count: number }>
}

const GAP_LABELS: Record<ReadinessCheckId, string> = {
  photo: "a photo",
  brand: "a brand",
  size: "a size",
  price: "a price",
  description: "an approved description",
  link: "a shop link",
}

/** Merchandiser: which new arrivals aren't ready to post, and why. */
export function merchandiserReport(input: {
  items: MarketingEntity[]
  entityId: string
  websiteUrl?: string | null
  requireSize: boolean
}): MerchandiserReport {
  const findings: MerchandiserFinding[] = []
  const gapCounts = new Map<ReadinessCheckId, number>()
  let ready = 0
  for (const item of input.items) {
    const readiness = getPostReadiness({
      item,
      entityId: input.entityId,
      websiteUrl: input.websiteUrl,
      requireSize: input.requireSize,
    })
    if (readiness.ready) {
      ready += 1
      continue
    }
    findings.push({
      item,
      missing: readiness.missing.map((check) => ({ id: check.id, label: check.label })),
    })
    for (const check of readiness.missing) {
      gapCounts.set(check.id, (gapCounts.get(check.id) ?? 0) + 1)
    }
  }
  const gaps = [...gapCounts.entries()]
    .map(([id, count]) => ({ id, label: GAP_LABELS[id], count }))
    .sort((a, b) => b.count - a.count)
  return { checked: input.items.length, ready, findings, gaps }
}

export type ArtDirectorFormat = "carousel" | "story" | "reel"

export type ArtDirectorPick = {
  id: string
  format: ArtDirectorFormat
  title: string
  /** Why this format, in plain words. */
  reason: string
  items: MarketingEntity[]
}

function firstPhoto(item: MarketingEntity): string | null {
  return item.images.find((url) => /^https?:\/\//i.test(url)) ?? null
}

function hasVideo(item: MarketingEntity): boolean {
  return item.images.some((url) => detectMediaKindFromUrl(url) === "video")
}

/** "Maxi Dress Miracle in green" → "Maxi"; good enough to group like garments. */
function garmentWord(item: MarketingEntity): string | null {
  const word = item.title.trim().split(/[\s/-]+/)[0]
  return word && /^[A-Za-z]{3,}$/.test(word) ? word : null
}

function groupBy(
  items: MarketingEntity[],
  key: (item: MarketingEntity) => string | null
): Array<[string, MarketingEntity[]]> {
  const map = new Map<string, MarketingEntity[]>()
  for (const item of items) {
    const k = key(item)?.trim()
    if (!k) continue
    const list = map.get(k.toLowerCase()) ?? []
    list.push(item)
    map.set(k.toLowerCase(), list)
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

/**
 * Art director: turn the newest arrivals into a few ready-made posts —
 * carousels of things that belong together, cutout Stories with a shop link
 * for strong single pieces, and Reels when there's video.
 */
export function artDirectorPicks(input: {
  items: MarketingEntity[]
  isFashion: boolean
  max?: number
}): ArtDirectorPick[] {
  const max = input.max ?? 5
  const pool = input.items.filter((item) => firstPhoto(item) || hasVideo(item))
  const used = new Set<string>()
  const picks: ArtDirectorPick[] = []
  const free = () => pool.filter((item) => !used.has(item.id))
  const take = (list: MarketingEntity[]) => {
    list.forEach((item) => used.add(item.id))
    return list
  }

  for (const item of free().filter(hasVideo)) {
    if (picks.length >= max) break
    picks.push({
      id: `reel-${item.id}`,
      format: "reel",
      title: item.title,
      reason: "Has video — Reels reach the most people.",
      items: take([item]),
    })
  }

  // Carousels: same vibe first, then the same kind of garment, then brand.
  const groupers: Array<{
    key: (item: MarketingEntity) => string | null
    title: (label: string) => string
    reason: (label: string, n: number) => string
  }> = [
    {
      key: (item) => item.vibe,
      title: (label) => `Shop by vibe: ${label}`,
      reason: (label, n) => `${n} new pieces share the ${label} vibe — swipeable edit.`,
    },
    {
      key: garmentWord,
      title: (label) => `New in: ${label}`,
      reason: (label, n) => `${n} new ${label.toLowerCase()} pieces — one carousel beats ${n} posts.`,
    },
    {
      key: (item) => item.brand,
      title: (label) => `${label} just landed`,
      reason: (label, n) => `${n} pieces from ${label} — brand fans swipe through all of them.`,
    },
  ]
  for (const grouper of groupers) {
    for (const [, group] of groupBy(free(), grouper.key)) {
      if (picks.length >= max) break
      if (group.length < 3) continue
      const items = take(group.slice(0, 6))
      const label =
        grouper.key(items[0])?.trim() || items[0].title
      picks.push({
        id: `carousel-${items[0].id}`,
        format: "carousel",
        title: grouper.title(label),
        reason: grouper.reason(label, items.length),
        items,
      })
    }
  }

  // Strong single pieces: a cutout Story with a link (fashion) or a post.
  for (const item of free()) {
    if (picks.length >= max) break
    if (!firstPhoto(item) || !item.brand) continue
    picks.push({
      id: `story-${item.id}`,
      format: "story",
      title: item.title,
      reason: input.isFashion
        ? "Standout single piece — cutout Story with a shop link."
        : "Standout single — a Story with a link.",
      items: take([item]),
    })
  }

  return picks
}
