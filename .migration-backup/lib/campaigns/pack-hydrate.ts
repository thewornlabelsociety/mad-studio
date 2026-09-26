import {
  campaignPackSchema,
  type CampaignPack,
} from "@/lib/campaigns/pack-schema"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import { MULTIPLEXER_INTENTS } from "@/lib/campaigns/multiplexer"
import type { FudiAudienceTrack } from "@/lib/studio/fudi-tracks"

export type StudioContext = {
  event_description: string
  intent: MultiplexerIntent
  objective: string
  persona_name: string | null
  fudi_track: FudiAudienceTrack | null
}

export type ActiveMultiplexerPackBuffer = {
  packId: string
  entityId: string
  pack: CampaignPack
  mediaUrl: string | null
  eventDescription: string
  intent: MultiplexerIntent
  objective: string
  personaName: string | null
  fudiTrack?: FudiAudienceTrack | null
  savedAt: string
}

export const ACTIVE_MULTIPLEXER_PACK_KEY = "active_multiplexer_pack"

export function parseStudioContext(value: unknown): StudioContext | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const eventDescription =
    typeof record.event_description === "string"
      ? record.event_description
      : ""
  const objective =
    typeof record.objective === "string" ? record.objective : ""
  const personaName =
    typeof record.persona_name === "string" ? record.persona_name : null
  const intentRaw =
    typeof record.intent === "string" ? record.intent : "Drive Sales"
  const intent = (MULTIPLEXER_INTENTS as readonly string[]).includes(intentRaw)
    ? (intentRaw as MultiplexerIntent)
    : "Drive Sales"
  const trackRaw =
    typeof record.fudi_track === "string" ? record.fudi_track : null
  const fudiTrack =
    trackRaw === "diners" || trackRaw === "partners" ? trackRaw : null

  return {
    event_description: eventDescription,
    intent,
    objective,
    persona_name: personaName,
    fudi_track: fudiTrack,
  }
}

export function buildStudioContext(input: {
  eventDescription: string
  intent: MultiplexerIntent
  objective: string
  personaName?: string | null
  fudiTrack?: FudiAudienceTrack | null
}): StudioContext {
  return {
    event_description: input.eventDescription.slice(0, 500),
    intent: input.intent,
    objective: input.objective,
    persona_name: input.personaName?.trim() || null,
    fudi_track: input.fudiTrack ?? null,
  }
}

/** Rebuild a CampaignPack from campaigns.asset_pack + algorithmic_signals + title. */
export function campaignRowToPack(input: {
  title: string
  algorithmic_signals: unknown
  asset_pack: unknown
}): CampaignPack | null {
  if (!input.asset_pack || typeof input.asset_pack !== "object") return null
  const assets = input.asset_pack as Record<string, unknown>
  const signals =
    input.algorithmic_signals && typeof input.algorithmic_signals === "object"
      ? input.algorithmic_signals
      : null

  const candidate = {
    campaign_title: input.title,
    algorithmic_signals: signals,
    short_video_script: assets.short_video ?? assets.short_video_script,
    carousel: assets.carousel,
    seo_caption: assets.seo_caption,
    email_drop: assets.email_drop,
    b2b_dm: assets.b2b_dm,
  }

  const parsed = campaignPackSchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function readActiveMultiplexerBuffer(
  entityId?: string | null
): ActiveMultiplexerPackBuffer | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ACTIVE_MULTIPLEXER_PACK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveMultiplexerPackBuffer
    if (!parsed?.packId || !parsed?.entityId || !parsed?.pack) return null
    if (entityId && parsed.entityId !== entityId) return null
    const pack = campaignPackSchema.safeParse(parsed.pack)
    if (!pack.success) return null
    return { ...parsed, pack: pack.data }
  } catch {
    return null
  }
}

export function writeActiveMultiplexerBuffer(
  buffer: ActiveMultiplexerPackBuffer
): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      ACTIVE_MULTIPLEXER_PACK_KEY,
      JSON.stringify(buffer)
    )
  } catch {
    /* quota / private mode */
  }
}

export function clearActiveMultiplexerBuffer(entityId?: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (!entityId) {
      window.localStorage.removeItem(ACTIVE_MULTIPLEXER_PACK_KEY)
      return
    }
    const current = readActiveMultiplexerBuffer()
    if (!current || current.entityId === entityId) {
      window.localStorage.removeItem(ACTIVE_MULTIPLEXER_PACK_KEY)
    }
  } catch {
    /* ignore */
  }
}

export function formatDraftRestoredAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
