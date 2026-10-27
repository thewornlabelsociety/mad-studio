import { readableListingCaption } from "@/lib/inventory/context-hooks"
import type { BrandIdentity } from "@/lib/entities/dna-schema"
import type { MarketingEntity } from "@/lib/inventory/types"

export type IntakeCaptionDefaultSource = "title" | "listing_description"

export const INTAKE_CAPTION_DEFAULT_LABELS: Record<
  IntakeCaptionDefaultSource,
  string
> = {
  title: "Listing title",
  listing_description: "Website description",
}

export function resolveIntakeCaptionDefaultSource(
  brandIdentity: BrandIdentity | null | undefined
): IntakeCaptionDefaultSource {
  const raw = brandIdentity?.intake_caption_default
  return raw === "title" ? "title" : "listing_description"
}

export function seedIntakeCopyDraft(input: {
  source: IntakeCaptionDefaultSource
  title: string
  brand: string | null
  description: string | null
}): { headline: string; caption: string } {
  const title = input.title.trim()
  const brand = input.brand?.trim() || null

  if (input.source === "title") {
    const headline = brand && !title.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} · ${title}`
      : title
    return { headline, caption: title }
  }

  const cleaned =
    readableListingCaption({
      title,
      description: input.description,
      brand,
    }) || title

  const headline =
    brand && !cleaned.toLowerCase().includes(brand.toLowerCase())
      ? brand
      : title.slice(0, 120)

  return { headline, caption: cleaned }
}

export function defaultIntakeCaptionForItem(
  item: Pick<MarketingEntity, "title" | "brand" | "description" | "copy_draft">,
  source: IntakeCaptionDefaultSource
): { headline: string; caption: string } {
  const fromDraft = item.copy_draft?.caption?.trim()
  if (fromDraft) {
    return {
      headline: item.copy_draft?.headline?.trim() || item.title.trim(),
      caption: fromDraft,
    }
  }
  return seedIntakeCopyDraft({
    source,
    title: item.title,
    brand: item.brand,
    description: item.description,
  })
}

export function buildSeededCopyDraft(input: {
  source: IntakeCaptionDefaultSource
  title: string
  brand: string | null
  description: string | null
  syncedAt: string
}): Record<string, unknown> {
  const { headline, caption } = seedIntakeCopyDraft(input)
  return {
    headline,
    caption,
    metadata: {
      intake_caption_source: input.source,
      intake_caption_seeded: true,
      intake_caption_seeded_at: input.syncedAt,
    },
  }
}
