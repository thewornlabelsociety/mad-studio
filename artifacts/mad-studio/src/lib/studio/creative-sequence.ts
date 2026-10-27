/**
 * Checkpoint 4 — durable multi-frame Story/Feed creative sequence.
 * Stored in campaigns.studio_context.metadata.creative_sequence (JSON, no migration).
 */
import type { MediaAsset } from "@/components/marketing/media-tray"
import type { StoryPreviewState } from "@/components/marketing/multi-platform-simulator"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import type { ListingAvailability } from "@/lib/inventory/listing-availability"
import {
  normalizeCanvasTextOverlay,
  type CanvasTextOverlayState,
} from "@/lib/studio/canvas-text-types"

export const CREATIVE_SEQUENCE_VERSION = 1 as const

export type CreativeSurface = "story" | "feed"

export type CreativeSequenceFrame = {
  assetId: string
  order: number
  mediaUrl: string
  productId: string | null
  destinationUrl: string | null
  intakeCaption: string | null
  overlay: CanvasTextOverlayState
  /** Snapshot at save time — reopen compares against live listing state. */
  availabilityAtSave?: ListingAvailability | null
}

export type CreativeSequenceState = {
  version: typeof CREATIVE_SEQUENCE_VERSION
  surface: CreativeSurface
  /** Preview rail id (e.g. ig_story) — not independent per-channel styling. */
  activeChannel: string
  templateInstanceId: string | null
  templateVersionId: string | null
  visualOnly: boolean
  storyPreview: StoryPreviewState
  frames: CreativeSequenceFrame[]
  rawSpark: string
}

export type CreativeSequenceRestore = {
  mediaAssets: MediaAsset[]
  slideOverlays: Record<string, CanvasTextOverlayState>
  storyPreview: StoryPreviewState
  surface: CreativeSurface
  activeChannel: string
  templateInstanceId: string | null
  templateVersionId: string | null
  visualOnly: boolean
  rawSpark: string
  productIds: string[]
  soldProductIds: string[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function trimUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

/** Minimal CampaignPack that passes persistence schema — for visual-only drafts. */
export function buildVisualOnlyCampaignPack(input: {
  title: string
  captionHint?: string
  frameCount: number
}): CampaignPack {
  const title = input.title.trim() || "Story draft"
  const caption =
    input.captionHint?.trim() ||
    `Visual draft · ${input.frameCount} frame${input.frameCount === 1 ? "" : "s"}`
  return {
    campaign_title: title.slice(0, 120),
    algorithmic_signals: {
      spoken_hook: title.slice(0, 80),
      on_screen_text: "New arrival",
      search_keywords: ["new arrival", "fashion", "story"],
    },
    short_video_script: {
      hook_visual: "Product hero",
      spoken_lines: [title.slice(0, 120), "Shop the drop."],
      b_roll_cues: ["Detail shot"],
      cta_spoken: "Tap the link sticker",
    },
    carousel: {
      title,
      slides: [1, 2, 3].map((slide_number) => ({
        slide_number,
        headline: title.slice(0, 60),
        body_text: caption.slice(0, 200),
      })),
    },
    seo_caption: {
      caption_body: caption.slice(0, 2200),
      search_optimized_tags: ["newarrival", "fashion", "wornlabel"],
    },
    email_drop: {
      subject_line: title.slice(0, 80),
      preview_text: caption.slice(0, 120),
      body_markdown: caption,
    },
    b2b_dm: {
      platform: "instagram",
      message_text: caption.slice(0, 500),
    },
  }
}

export function buildCreativeSequence(input: {
  mediaAssets: MediaAsset[]
  slideOverlays: Record<string, CanvasTextOverlayState>
  storyPreview: StoryPreviewState
  surface: CreativeSurface
  activeChannel: string
  templateInstanceId?: string | null
  templateVersionId?: string | null
  visualOnly: boolean
  rawSpark?: string
  availabilityByProductId?: Record<string, ListingAvailability>
}): CreativeSequenceState | null {
  const frames: CreativeSequenceFrame[] = []
  input.mediaAssets.forEach((asset, index) => {
    if (asset.type === "video") return
    const mediaUrl =
      trimUrl(asset.publicUrl) ?? trimUrl(asset.url) ?? ""
    if (!mediaUrl) return
    const productId = asset.marketingEntityId?.trim() || null
    frames.push({
      assetId: asset.id,
      order: frames.length,
      mediaUrl,
      productId,
      destinationUrl: asset.destinationUrl?.trim() || null,
      intakeCaption: asset.intakeCaption?.trim() || null,
      overlay: normalizeCanvasTextOverlay(
        input.slideOverlays[asset.id] ?? null
      ),
      availabilityAtSave: productId
        ? input.availabilityByProductId?.[productId] ?? null
        : null,
    })
    void index
  })
  if (frames.length === 0) return null
  return {
    version: CREATIVE_SEQUENCE_VERSION,
    surface: input.surface,
    activeChannel: input.activeChannel.trim() || "ig_story",
    templateInstanceId: input.templateInstanceId?.trim() || null,
    templateVersionId: input.templateVersionId?.trim() || null,
    visualOnly: input.visualOnly,
    storyPreview: { ...input.storyPreview },
    frames,
    rawSpark: (input.rawSpark ?? "").slice(0, 2000),
  }
}

export function parseCreativeSequence(
  value: unknown
): CreativeSequenceState | null {
  const root = asRecord(value)
  if (!root) return null
  if (root.version !== CREATIVE_SEQUENCE_VERSION) return null
  const surface = root.surface === "feed" ? "feed" : "story"
  const framesRaw = Array.isArray(root.frames) ? root.frames : []
  const frames: CreativeSequenceFrame[] = []
  for (const row of framesRaw) {
    const record = asRecord(row)
    if (!record) continue
    const mediaUrl = trimUrl(record.mediaUrl)
    if (!mediaUrl) continue
    const assetId =
      typeof record.assetId === "string" && record.assetId.trim()
        ? record.assetId.trim()
        : `frame-${frames.length}`
    frames.push({
      assetId,
      order:
        typeof record.order === "number" && Number.isFinite(record.order)
          ? record.order
          : frames.length,
      mediaUrl,
      productId:
        typeof record.productId === "string" && record.productId.trim()
          ? record.productId.trim()
          : null,
      destinationUrl: trimUrl(record.destinationUrl),
      intakeCaption:
        typeof record.intakeCaption === "string"
          ? record.intakeCaption
          : null,
      overlay: normalizeCanvasTextOverlay(record.overlay),
      availabilityAtSave:
        record.availabilityAtSave === "sold" ||
        record.availabilityAtSave === "unavailable" ||
        record.availabilityAtSave === "available" ||
        record.availabilityAtSave === "unknown"
          ? record.availabilityAtSave
          : null,
    })
  }
  if (frames.length === 0) return null
  frames.sort((a, b) => a.order - b.order)
  const previewRaw = asRecord(root.storyPreview) ?? {}
  const storyPreview: StoryPreviewState = {
    stylePreset:
      typeof previewRaw.stylePreset === "string"
        ? (previewRaw.stylePreset as StoryPreviewState["stylePreset"])
        : "moody_noir",
    canvasColor:
      typeof previewRaw.canvasColor === "string" ? previewRaw.canvasColor : "",
    bgPresetId:
      typeof previewRaw.bgPresetId === "string" ? previewRaw.bgPresetId : "brand",
    cutoutMode:
      previewRaw.cutoutMode === "transparent" ? "transparent" : "original",
    cutoutImageUrl: trimUrl(previewRaw.cutoutImageUrl),
    subjectScale:
      typeof previewRaw.subjectScale === "number"
        ? previewRaw.subjectScale
        : 1,
    subjectOffsetY:
      typeof previewRaw.subjectOffsetY === "number"
        ? previewRaw.subjectOffsetY
        : 0,
  }
  return {
    version: CREATIVE_SEQUENCE_VERSION,
    surface,
    activeChannel:
      typeof root.activeChannel === "string" && root.activeChannel.trim()
        ? root.activeChannel.trim()
        : surface === "story"
          ? "ig_story"
          : "ig_feed",
    templateInstanceId:
      typeof root.templateInstanceId === "string"
        ? root.templateInstanceId
        : null,
    templateVersionId:
      typeof root.templateVersionId === "string"
        ? root.templateVersionId
        : null,
    visualOnly: root.visualOnly === true,
    storyPreview,
    frames,
    rawSpark: typeof root.rawSpark === "string" ? root.rawSpark : "",
  }
}

export function restoreCreativeSequence(
  sequence: CreativeSequenceState,
  liveAvailability?: Record<string, ListingAvailability>
): CreativeSequenceRestore {
  const ordered = [...sequence.frames].sort((a, b) => a.order - b.order)
  const mediaAssets: MediaAsset[] = []
  const slideOverlays: Record<string, CanvasTextOverlayState> = {}
  const soldProductIds: string[] = []
  const productIds: string[] = []

  for (const frame of ordered) {
    mediaAssets.push({
      id: frame.assetId,
      url: frame.mediaUrl,
      publicUrl: frame.mediaUrl,
      type: "image",
      marketingEntityId: frame.productId,
      destinationUrl: frame.destinationUrl,
      intakeCaption: frame.intakeCaption,
    })
    slideOverlays[frame.assetId] = normalizeCanvasTextOverlay(frame.overlay)
    if (frame.productId) {
      productIds.push(frame.productId)
      const live = liveAvailability?.[frame.productId]
      if (live === "sold" || live === "unavailable") {
        soldProductIds.push(frame.productId)
      }
    }
  }

  return {
    mediaAssets,
    slideOverlays,
    storyPreview: { ...sequence.storyPreview },
    surface: sequence.surface,
    activeChannel: sequence.activeChannel,
    templateInstanceId: sequence.templateInstanceId,
    templateVersionId: sequence.templateVersionId,
    visualOnly: sequence.visualOnly,
    rawSpark: sequence.rawSpark,
    productIds,
    soldProductIds,
  }
}

/** Round-trip helper for tests — order, overlays, URLs, products. */
export function creativeSequenceRoundTrip(
  input: Parameters<typeof buildCreativeSequence>[0]
): CreativeSequenceRestore | null {
  const built = buildCreativeSequence(input)
  if (!built) return null
  const parsed = parseCreativeSequence(JSON.parse(JSON.stringify(built)))
  if (!parsed) return null
  return restoreCreativeSequence(parsed, input.availabilityByProductId)
}

/**
 * Future: independent Feed vs Story overlay maps keyed by surface.
 * Today Studio shares one overlay map across preview channels — switching
 * preview must not clear Story edits (surface + storyPreview are explicit).
 */
export const CREATIVE_SEQUENCE_CHANNEL_STATE_NOTE =
  "Overlays are shared across preview channels. Persist creative_sequence.surface + storyPreview; do not wipe overlays on Feed/TikTok preview. Per-channel overlay maps would be the smallest next step."
