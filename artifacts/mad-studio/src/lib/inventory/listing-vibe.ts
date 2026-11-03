/**
 * Worn Label Shop-by-Vibe slugs → the names the website shows now
 * (from /api/public/marketplace/aesthetics). The slugs never change, but the
 * names do — e.g. "indie-sleaze" is now shown as "Indie".
 */
const AESTHETIC_LABELS: Record<string, string> = {
  "elevated-basics": "Basics",
  "vintage-collector": "Vintage",
  "cottage-core": "Cottagecore",
  cottagecore: "Cottagecore",
  "wild-sophistication": "Wild",
  "romantic-statement": "Romantic",
  "corporate-dressing": "Corporate",
  preppy: "Preppy",
  "kiwi-maximalist-eclectic-glam": "Maximalist",
  "alpine-essentials": "Alpine",
  "festival-vibes": "Festival",
  "modern-bohemia": "Boho",
  "euro-summer-escape": "Resort",
  "euro-summer": "Resort",
  "coastal-creative": "Coastal",
  "athleisure-socialite": "Athleisure",
  "contemporary-maori-creative": "Contemporary Māori Creative",
  "y2k-revival": "Y2K",
  "street-archive": "Street",
  "modern-gent": "Dapper",
  "workwear-heritage": "Heritage",
  "minimal-uniform": "Minimal",
  "event-dressing": "Occasion",
  "indie-sleaze": "Indie",
  blokecore: "Blokecore",
  "campus-cool": "Varsity",
  "surf-street": "Surf",
  "after-hours": "Evening",
  "soft-feminine": "Feminine",
  natural: "Natural",
}

/** Old names saved before the website renamed its vibes. */
const LEGACY_LABELS: Record<string, string> = {
  "euro summer escape": "euro-summer-escape",
  "kiwi maximalist eclectic glam": "kiwi-maximalist-eclectic-glam",
  "cottage core": "cottage-core",
}

function slugifyVibe(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
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

/**
 * A vibe name as the website shows it today. Old saved names ("Indie
 * Sleaze", "Euro Summer Escape") become the new ones; anything else (your
 * own wording) is left as it is.
 */
export function currentVibeLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const legacySlug = LEGACY_LABELS[trimmed.toLowerCase()]
  if (legacySlug) return AESTHETIC_LABELS[legacySlug] ?? trimmed
  const slug = slugifyVibe(trimmed)
  return AESTHETIC_LABELS[slug] ?? trimmed
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
    vibe: currentVibeLabel(listed) || resolveListingVibe(aesthetic_slugs),
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
