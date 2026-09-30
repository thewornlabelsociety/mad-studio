import type { MarketingCopyDraft } from "@/lib/inventory/types"

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
