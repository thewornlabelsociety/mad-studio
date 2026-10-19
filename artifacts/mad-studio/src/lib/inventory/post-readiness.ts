import type { MarketingEntity } from "@/lib/inventory/types"
import {
  extractSizeLabel,
  resolveItemDestinationUrl,
} from "@/lib/marketing/story-presets"

export type ReadinessCheckId =
  | "photo"
  | "brand"
  | "size"
  | "price"
  | "description"
  | "link"

export type ReadinessCheck = {
  id: ReadinessCheckId
  label: string
  ok: boolean
  /** What's there now (shown next to the tick), or why it's missing. */
  detail: string
}

export type PostReadiness = {
  ready: boolean
  checks: ReadinessCheck[]
  missing: ReadinessCheck[]
  brand: string | null
  size: string | null
  /** Approved description, if any. */
  description: string | null
  destinationUrl: string | null
}

/** The brand shown on posts: operator override, else the synced listing brand. */
export function postBrandFor(item: MarketingEntity): string | null {
  return (
    item.copy_draft?.metadata?.post_brand?.trim() || item.brand?.trim() || null
  )
}

export function approvedDescriptionFor(item: MarketingEntity): string | null {
  const meta = item.copy_draft?.metadata
  const text = meta?.post_description?.trim()
  return text && meta?.post_description_approved_at ? text : null
}

/**
 * Whether an item has everything a post needs before it goes out. Size only
 * applies to fashion (consignment) brands.
 */
export function getPostReadiness(input: {
  item: MarketingEntity
  entityId: string
  websiteUrl?: string | null
  requireSize: boolean
}): PostReadiness {
  const { item } = input
  const photo = item.images.find((url) => /^https?:\/\//i.test(url)) ?? null
  const brand = postBrandFor(item)
  const size = extractSizeLabel(item)
  const description = approvedDescriptionFor(item)
  const draftDescription = item.copy_draft?.metadata?.post_description?.trim()
  const destinationUrl = resolveItemDestinationUrl({
    entityId: input.entityId,
    websiteUrl: input.websiteUrl,
    websiteItemId: item.website_item_id,
    copyDraft: item.copy_draft,
  })

  const checks: ReadinessCheck[] = [
    {
      id: "photo",
      label: "Photo",
      ok: Boolean(photo),
      detail: photo
        ? `${item.images.length} photo${item.images.length === 1 ? "" : "s"}`
        : "Add a photo",
    },
    {
      id: "brand",
      label: "Brand",
      ok: Boolean(brand),
      detail: brand ?? "Add the brand",
    },
    ...(input.requireSize
      ? [
          {
            id: "size" as const,
            label: "Size",
            ok: Boolean(size),
            detail: size ?? "Add the size",
          },
        ]
      : []),
    {
      id: "price",
      label: "Price",
      ok: item.price != null,
      detail: item.price != null ? `$${item.price}` : "No price on listing",
    },
    {
      id: "description",
      label: "Description approved",
      ok: Boolean(description),
      detail: description
        ? "Approved"
        : draftDescription
          ? "Written, not approved yet"
          : "Write and approve",
    },
    {
      id: "link",
      label: "Shop link",
      ok: Boolean(destinationUrl),
      detail: destinationUrl ?? "No listing link",
    },
  ]

  const missing = checks.filter((check) => !check.ok)
  return {
    ready: missing.length === 0,
    checks,
    missing,
    brand,
    size,
    description,
    destinationUrl,
  }
}
