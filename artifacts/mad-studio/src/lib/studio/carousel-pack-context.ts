import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import type { MediaAsset } from "@/components/marketing/media-tray"
import { sanitizeBrandName } from "@/lib/copy/caption-hygiene"

export type CarouselSlideContext = {
  index: number
  brand: string | null
  vibe: string | null
  size: string | null
  /** Website / intake line for this slide's item. */
  listingLine: string | null
  visualSummary: string | null
  aestheticTags: string[]
}

export type CarouselPackContext = {
  isCarousel: boolean
  photoCount: number
  slides: CarouselSlideContext[]
  /** Unique designer / brand names across slides. */
  brands: string[]
  /** Unique vibe labels across slides. */
  vibes: string[]
  /** Short operator-facing summary for AI prompts. */
  editorSummary: string
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const text = raw?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }
  return out
}

export function buildCarouselPackContext(input: {
  assets: MediaAsset[]
  slideFacts: Record<string, CanvasItemFacts>
}): CarouselPackContext {
  const photos = input.assets.filter((row) => row.type !== "video")
  const slides: CarouselSlideContext[] = photos.map((asset, index) => {
    const facts = input.slideFacts[asset.id]
    const inspection = asset.visualInspection
    return {
      index: index + 1,
      brand: facts?.brand?.trim() || null,
      vibe: facts?.vibe?.trim() || null,
      size: facts?.size?.trim() || null,
      listingLine: asset.intakeCaption?.trim() || null,
      visualSummary: inspection?.visualDescription?.trim() || null,
      aestheticTags: inspection?.aestheticTags ?? [],
    }
  })

  const brands = uniqueStrings(
    slides.map((row) => row.brand).map((b) => sanitizeBrandName(b ?? "") || b)
  )
  const vibes = uniqueStrings(slides.map((row) => row.vibe))
  const listingLines = uniqueStrings(slides.map((row) => row.listingLine))

  const moodTags = uniqueStrings(
    slides.flatMap((row) => row.aestheticTags)
  ).slice(0, 8)

  const editorSummary =
    photos.length >= 2
      ? [
          `Carousel · ${photos.length} photos`,
          brands.length ? `Designers: ${brands.join(", ")}` : "",
          vibes.length ? `Vibes: ${vibes.join(", ")}` : "",
          moodTags.length ? `Visual mood: ${moodTags.join(", ")}` : "",
          listingLines.length
            ? `Listing copy (per slide): ${listingLines.map((line) => line.slice(0, 120)).join(" | ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : slides[0]?.listingLine?.slice(0, 200) ||
        slides[0]?.visualSummary?.slice(0, 200) ||
        ""

  return {
    isCarousel: photos.length >= 2,
    photoCount: photos.length,
    slides,
    brands,
    vibes,
    editorSummary,
  }
}

/** Merge vision text from every inspected slide (not only the active thumb). */
export function mergedCarouselVision(input: {
  assets: MediaAsset[]
  activeDescription?: string | null
}): {
  visualDescription: string
  aestheticTags: string[]
  concreteFeatures: string[]
} {
  const photos = input.assets.filter((row) => row.type !== "video")
  const blocks: string[] = []
  const aesthetic = new Set<string>()
  const features = new Set<string>()

  photos.forEach((asset, index) => {
    const v = asset.visualInspection
    if (!v?.visualDescription?.trim()) return
    blocks.push(`Slide ${index + 1}: ${v.visualDescription.trim()}`)
    for (const tag of v.aestheticTags ?? []) aesthetic.add(tag)
    for (const feat of v.concreteFeatures ?? []) features.add(feat)
  })

  if (blocks.length === 0 && input.activeDescription?.trim()) {
    blocks.push(input.activeDescription.trim())
  }

  return {
    visualDescription: blocks.join("\n"),
    aestheticTags: [...aesthetic],
    concreteFeatures: [...features],
  }
}
