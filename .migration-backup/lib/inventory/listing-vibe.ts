/**
 * Worn Label / marketplace aesthetic slugs → display labels.
 * Prefer explicit maps; fall back to title-casing the slug.
 */
const AESTHETIC_LABELS: Record<string, string> = {
  "quiet-luxury": "Quiet Luxury",
  "modern-muse": "Modern Muse",
  "everyday-muse": "Everyday Muse",
  "modern-bohemia": "Modern Bohemia",
  "coastal-creative": "Coastal Creative",
  "euro-summer": "Euro Summer Escape",
  "euro-summer-escape": "Euro Summer Escape",
  "street-archive": "Street Archive",
  "cottage-core": "Cottage Core",
  "cottagecore": "Cottage Core",
}

export function labelFromAestheticSlug(slug: string): string {
  const key = slug.trim().toLowerCase()
  if (!key) return ""
  if (AESTHETIC_LABELS[key]) return AESTHETIC_LABELS[key]
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function parseAestheticSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") continue
    const slug = entry.trim().toLowerCase()
    if (!slug || out.includes(slug)) continue
    out.push(slug)
  }
  return out
}

/** Primary listing vibe from marketplace aestheticSlugs. */
export function resolveListingVibe(
  slugs: string[] | null | undefined
): string | null {
  const first = slugs?.[0]
  if (!first) return null
  return labelFromAestheticSlug(first) || null
}

export function readListingVibeFromMetrics(metrics: unknown): {
  vibe: string | null
  aesthetic_slugs: string[]
} {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return { vibe: null, aesthetic_slugs: [] }
  }
  const record = metrics as Record<string, unknown>
  const aesthetic_slugs = parseAestheticSlugs(record.aesthetic_slugs)
  const listed =
    typeof record.listing_vibe === "string" && record.listing_vibe.trim()
      ? record.listing_vibe.trim()
      : null
  return {
    vibe: listed || resolveListingVibe(aesthetic_slugs),
    aesthetic_slugs,
  }
}

export function withListingVibeMetrics(
  metrics: Record<string, unknown>,
  input: { vibe: string | null; aesthetic_slugs: string[] }
): Record<string, unknown> {
  const next = { ...metrics }
  if (input.vibe) next.listing_vibe = input.vibe
  else delete next.listing_vibe
  if (input.aesthetic_slugs.length > 0) {
    next.aesthetic_slugs = input.aesthetic_slugs
  } else {
    delete next.aesthetic_slugs
  }
  return next
}
