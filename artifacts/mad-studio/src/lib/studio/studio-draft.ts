import type { MediaAsset } from "@/components/marketing/media-tray"
import type { CanvasItemFacts } from "@/components/studio/canvas-text-overlay"
import type { CanvasTextOverlayState } from "@/lib/studio/canvas-text-types"

/**
 * The post you're working on in Studio, kept per brand in this browser so
 * clicking away never loses it. It mirrors what's on screen: an empty Studio
 * means no draft, so "Clear draft" stays cleared.
 */
export type StudioDraft = {
  v: 1
  entityId: string
  savedAt: string
  step: number
  media: MediaAsset[]
  activeMediaId: string | null
  slideOverlays: Record<string, CanvasTextOverlayState>
  slideFacts: Record<string, CanvasItemFacts>
  rawSpark: string
  headline: string
  intent: string
  intentChipId: string
  objective: string
  personaId: string
  fudiTrack: string | null
  /** The caption pack's campaign, once one is generated. */
  packId: string | null
}

const KEY_PREFIX = "mad-studio-draft:"
/** Drafts older than this are let go. */
const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

const keyFor = (entityId: string) => `${KEY_PREFIX}${entityId}`

/** Only photos that live online survive a reload (not local blob: previews). */
export function savableMedia(media: MediaAsset[]): MediaAsset[] {
  return media
    .filter((row) => !row.uploading)
    .map((row): MediaAsset | null => {
      const url = row.publicUrl || row.url
      return /^https?:\/\//i.test(url)
        ? {
            id: row.id,
            url,
            publicUrl: url,
            type: row.type,
            visualInspection: row.visualInspection ?? null,
          }
        : null
    })
    .filter((row): row is MediaAsset => row !== null)
}

/** Is there anything worth keeping? */
export function draftHasContent(
  draft: Pick<StudioDraft, "media" | "rawSpark" | "headline" | "packId">
): boolean {
  return (
    draft.media.length > 0 ||
    draft.rawSpark.trim().length > 0 ||
    draft.headline.trim().length > 0 ||
    Boolean(draft.packId)
  )
}

export function readStudioDraft(entityId: string): StudioDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(keyFor(entityId))
    if (!raw) return null
    const draft = JSON.parse(raw) as StudioDraft
    if (draft?.v !== 1 || draft.entityId !== entityId) return null
    if (Date.now() - Date.parse(draft.savedAt) > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(keyFor(entityId))
      return null
    }
    return draftHasContent(draft) ? draft : null
  } catch {
    return null
  }
}

/** Save the draft, or remove it when Studio is empty. */
export function writeStudioDraft(draft: StudioDraft): void {
  if (typeof window === "undefined") return
  try {
    if (!draftHasContent(draft)) {
      window.localStorage.removeItem(keyFor(draft.entityId))
      return
    }
    window.localStorage.setItem(keyFor(draft.entityId), JSON.stringify(draft))
  } catch {
    /* quota / private mode */
  }
}

export function clearStudioDraft(entityId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(keyFor(entityId))
  } catch {
    /* ignore */
  }
}
