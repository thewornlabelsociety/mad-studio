import type { WlsProductSelection } from "../inventory/wls-product-eligibility.ts"
import { ownerLabelForHardBlock } from "../inventory/wls-product-eligibility.ts"

/** Subset of StoryCanvasModel fields used by the Daily Story renderer. */
export type WlsDailyStoryCanvasModel = {
  brandName: string
  title: string
  headline: string
  category: string
  designer: string
  priceLabel: string
  sizeLabel: string | null
  colorLabel: string | null
  productLabel: string
  vibeTag: string | null
  provenance: string | null
  stickerLabel: string
  footerLine: string
  specsLine: string
  imageUrl: string | null
}

/** NZD price label without pulling the full inventory types graph into tests. */
function formatNzdPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price)) return "—"
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(price)
}

/** Stable display name for the entity-owned template instance. */
export const WLS_DAILY_STORY_TEMPLATE_NAME = "WLS — Daily New Arrival Story"

export const WLS_DAILY_STORY_EXPORT = {
  width: 1080,
  height: 1920,
  format: "story_9_16" as const,
  stylePreset: "moody_noir" as const,
}

/** Cream / near-black defaults when Brand Brain palette is incomplete. */
export const WLS_DAILY_STORY_PALETTE = {
  canvas: "#E8DCC4",
  ink: "#111111",
  accent: "#C5A46D",
  mist: "#F4EFE6",
} as const

export type WlsDailyStoryRenderFailure =
  | "not_eligible"
  | "missing_image"
  | "missing_price"
  | "invalid_destination_url"
  | "not_available"
  | "availability_unknown"
  | "wrong_entity"
  | "cross_entity"
  | "not_fashion_brand"

export type WlsDailyStoryDraftMeta = {
  kind: "wls_daily_story"
  generation_key: string
  template_instance_id: string
  template_version_id: string | null
  marketing_entity_id: string
  website_item_id: string
  destination_url: string
  source_image_url: string
  rendered_url: string | null
  generated_at: string
  /** Export canvas size — always 1080×1920 for this template. */
  export_width: 1080
  export_height: 1920
}

/** Name/industry heuristic — no hardcoded entity UUID. */
export function isWornLabelFashionEntity(input: {
  name?: string | null
  industry?: string | null
}): boolean {
  const name = (input.name ?? "").toLowerCase()
  const industry = (input.industry ?? "").toLowerCase()
  if (
    name.includes("worn label") ||
    name.includes("wornlabel") ||
    /\bwls\b/.test(name)
  ) {
    return true
  }
  if (
    industry.includes("fashion") ||
    industry.includes("consignment") ||
    industry.includes("apparel")
  ) {
    // Fashion alone is not enough — require WLS-ish name when industry is generic fashion.
    return (
      name.includes("worn") ||
      name.includes("label") ||
      name.includes("society")
    )
  }
  return false
}

export function buildWlsDailyStoryGenerationKey(input: {
  marketingEntityId: string
  templateInstanceId: string
}): string {
  return `wls-daily-story:${input.marketingEntityId}:${input.templateInstanceId}`
}

/** Reject inaccurate renders before baking. */
export function assertWlsDailyStoryRenderable(input: {
  selection: WlsProductSelection
  entityId: string
  brandName?: string | null
  industry?: string | null
}): { ok: true } | { ok: false; reason: WlsDailyStoryRenderFailure; detail: string } {
  if (
    input.brandName != null &&
    !isWornLabelFashionEntity({
      name: input.brandName,
      industry: input.industry,
    })
  ) {
    return {
      ok: false,
      reason: "not_fashion_brand",
      detail: "Daily New Arrival Story is only for Worn Label Society brands.",
    }
  }

  if (input.selection.entityId !== input.entityId) {
    return {
      ok: false,
      reason: "cross_entity",
      detail: "Product belongs to a different brand entity.",
    }
  }

  if (!input.selection.storySelectable) {
    const first = input.selection.storyHardBlockers[0] ?? input.selection.hardBlockers[0]
    if (first === "not_available") {
      return {
        ok: false,
        reason: "not_available",
        detail: "Product is sold or unavailable.",
      }
    }
    if (first === "wrong_entity") {
      return {
        ok: false,
        reason: "wrong_entity",
        detail: "Product is not on the selected entity.",
      }
    }
    if (first === "missing_shop_link") {
      return {
        ok: false,
        reason: "invalid_destination_url",
        detail: "Missing WLS product URL for link-sticker handoff.",
      }
    }
    return {
      ok: false,
      reason: "not_eligible",
      detail: first
        ? ownerLabelForHardBlock(first)
        : "Product cannot be used for this Story.",
    }
  }

  const image = input.selection.sourceImageUrls.find((url) =>
    /^https?:\/\//i.test(url)
  )
  if (!image) {
    return {
      ok: false,
      reason: "missing_image",
      detail: "No usable product photograph on the listing.",
    }
  }

  if (
    !input.selection.destinationUrl ||
    !/^https?:\/\//i.test(input.selection.destinationUrl)
  ) {
    return {
      ok: false,
      reason: "invalid_destination_url",
      detail: "Missing WLS product URL for link-sticker handoff.",
    }
  }

  return { ok: true }
}

/**
 * Build StoryCanvas copy from Checkpoint A selection.
 * Verified size only — never invent. Missing size is omitted.
 */
export function buildWlsDailyStoryCanvasModel(input: {
  selection: WlsProductSelection
  brandName: string
  imageUrl: string
}): WlsDailyStoryCanvasModel {
  const { selection, brandName } = input
  const designer = (selection.brand?.trim() || brandName).trim()
  const title = selection.title.replace(/\s+/g, " ").trim()
  const shortTitle = title.length > 42 ? `${title.slice(0, 40).trim()}…` : title
  const priceLabel = formatNzdPrice(selection.price)
  const sizeLabel = selection.size?.trim()
    ? selection.size.trim().toUpperCase()
    : null

  const specsParts = [
    designer.toUpperCase(),
    shortTitle.toUpperCase().slice(0, 28),
    sizeLabel ? `SZ ${sizeLabel}` : null,
    priceLabel !== "—" ? priceLabel : null,
  ].filter(Boolean)

  return {
    brandName,
    title,
    headline: shortTitle,
    category: "New Arrival",
    designer,
    priceLabel,
    sizeLabel,
    colorLabel: null,
    productLabel: shortTitle,
    vibeTag: null,
    provenance: null,
    stickerLabel: "SHOP THE LOOK",
    footerLine: "NEW ARRIVAL // WORN LABEL SOCIETY",
    specsLine: specsParts.join(" // "),
    imageUrl: input.imageUrl,
  }
}

export function buildWlsDailyStoryDraftMeta(input: {
  selection: WlsProductSelection
  templateInstanceId: string
  templateVersionId: string | null
  sourceImageUrl: string
  renderedUrl: string | null
  generatedAt?: string
}): WlsDailyStoryDraftMeta {
  return {
    kind: "wls_daily_story",
    generation_key: buildWlsDailyStoryGenerationKey({
      marketingEntityId: input.selection.marketingEntityId,
      templateInstanceId: input.templateInstanceId,
    }),
    template_instance_id: input.templateInstanceId,
    template_version_id: input.templateVersionId,
    marketing_entity_id: input.selection.marketingEntityId,
    website_item_id: input.selection.websiteItemId,
    destination_url: input.selection.destinationUrl!,
    source_image_url: input.sourceImageUrl,
    rendered_url: input.renderedUrl,
    generated_at: input.generatedAt ?? new Date().toISOString(),
    export_width: 1080,
    export_height: 1920,
  }
}

export function readWlsDailyStoryDraftMeta(
  metadata: unknown
): WlsDailyStoryDraftMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null
  }
  const record = metadata as Record<string, unknown>
  const nested =
    record.wls_daily_story &&
    typeof record.wls_daily_story === "object" &&
    !Array.isArray(record.wls_daily_story)
      ? (record.wls_daily_story as Record<string, unknown>)
      : record.kind === "wls_daily_story"
        ? record
        : null
  if (!nested) return null
  if (nested.kind !== "wls_daily_story") return null
  if (typeof nested.generation_key !== "string") return null
  if (typeof nested.marketing_entity_id !== "string") return null
  if (typeof nested.destination_url !== "string") return null
  if (typeof nested.source_image_url !== "string") return null
  if (typeof nested.template_instance_id !== "string") return null
  if (typeof nested.website_item_id !== "string") return null

  return {
    kind: "wls_daily_story",
    generation_key: nested.generation_key,
    template_instance_id: nested.template_instance_id,
    template_version_id:
      typeof nested.template_version_id === "string"
        ? nested.template_version_id
        : null,
    marketing_entity_id: nested.marketing_entity_id,
    website_item_id: nested.website_item_id,
    destination_url: nested.destination_url,
    source_image_url: nested.source_image_url,
    rendered_url:
      typeof nested.rendered_url === "string" ? nested.rendered_url : null,
    generated_at:
      typeof nested.generated_at === "string"
        ? nested.generated_at
        : new Date(0).toISOString(),
    export_width: 1080,
    export_height: 1920,
  }
}
