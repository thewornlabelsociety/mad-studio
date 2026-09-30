import type { MarketingCopyDraft, MarketingEntity } from "@/lib/inventory/types"
import {
  FUDI_DROP_BADGES,
  type FudiDropKind,
  fudiChannelRecommendation,
  inferFudiDropKind,
} from "@/lib/today/agenda"

export const FUDI_DROP_KIND_OPTIONS = (
  Object.keys(FUDI_DROP_BADGES) as FudiDropKind[]
).map((id) => ({
  id,
  ...FUDI_DROP_BADGES[id],
}))

export const CHANNEL_HINT_PRESETS = [
  "TikTok / IG Story",
  "IG Carousel / Facebook",
  "TikTok / IG Feed",
  "Instagram Feed + Facebook",
] as const

function metadataRecord(
  copyDraft: MarketingCopyDraft | null | undefined
): Record<string, unknown> | null {
  const meta = copyDraft?.metadata
  if (!meta || typeof meta !== "object") return null
  return meta as Record<string, unknown>
}

export function readDropKindOverride(
  copyDraft: MarketingCopyDraft | null | undefined
): FudiDropKind | null {
  const raw = metadataRecord(copyDraft)?.drop_kind
  if (typeof raw !== "string") return null
  return raw in FUDI_DROP_BADGES ? (raw as FudiDropKind) : null
}

export function resolveFudiDropKind(item: MarketingEntity): FudiDropKind {
  const override = readDropKindOverride(item.copy_draft)
  if (override) return override
  return inferFudiDropKind(item)
}

export function readChannelHintOverride(
  copyDraft: MarketingCopyDraft | null | undefined
): string | null {
  const raw = metadataRecord(copyDraft)?.channel_hint
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

export function resolveFudiChannelHint(
  item: MarketingEntity,
  dropKind?: FudiDropKind
): string {
  const manual = readChannelHintOverride(item.copy_draft)
  if (manual) return manual
  return fudiChannelRecommendation(dropKind ?? resolveFudiDropKind(item))
}

export function readListingVibeOverride(
  copyDraft: MarketingCopyDraft | null | undefined
): string | null {
  const raw = metadataRecord(copyDraft)?.listing_vibe
  return typeof raw === "string" && raw.trim() ? raw.trim() : null
}

export type PostIntentState = {
  dropKind: FudiDropKind | null
  channelHint: string
  listingVibe: string
}

export function buildPostIntentMetadata(
  input: PostIntentState,
  options: { isFudi: boolean }
): NonNullable<MarketingCopyDraft["metadata"]> {
  const base: NonNullable<MarketingCopyDraft["metadata"]> = {}
  const vibe = input.listingVibe.trim()
  if (vibe) base.listing_vibe = vibe
  if (options.isFudi && input.dropKind) {
    base.drop_kind = input.dropKind
  }
  if (options.isFudi && input.channelHint.trim()) {
    base.channel_hint = input.channelHint.trim()
  }
  return base
}

export function mergeCopyDraftMetadata(
  existingDraft: Record<string, unknown>,
  metadata: MarketingCopyDraft["metadata"]
): Record<string, unknown> {
  const prev =
    existingDraft.metadata &&
    typeof existingDraft.metadata === "object" &&
    !Array.isArray(existingDraft.metadata)
      ? (existingDraft.metadata as Record<string, unknown>)
      : {}
  const nextMeta = { ...prev, ...metadata }
  return { ...existingDraft, metadata: nextMeta }
}
