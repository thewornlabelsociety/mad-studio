import { z } from "zod"
import { getRequestOrigin } from "@server/request-context"

import {
  FUDI_ENTITY_ID,
  FUDI_PUBLIC_ORIGIN,
} from "@/lib/studio/fudi-platform"

export const SOCIAL_PLATFORMS = ["instagram", "facebook", "tiktok"] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const publishPlacementSchema = z.enum(["feed", "story", "carousel"])
export type PublishPlacementInput = z.infer<typeof publishPlacementSchema>
/** Meta Graph placements actually dispatched today. */
export type PublishPlacement = "feed" | "story"

export const socialPublishRequestSchema = z.object({
  entityId: z.string().min(1).max(200).optional().nullable(),
  marketingEntityId: z.string().uuid().optional().nullable(),
  platform: z.enum(["instagram", "facebook", "tiktok", "email"]),
  placement: publishPlacementSchema.optional().default("feed"),
  caption: z.string().max(2200).optional(),
  mediaUrl: z.string().min(1).max(4000).optional(),
  destinationUrl: z.string().max(4000).optional().nullable(),
  connectionId: z.string().uuid().optional().nullable(),
  /** Preferred trackable slug seed, e.g. fudi-bao or partner-venue. */
  slugSeed: z.string().max(80).optional().nullable(),
  spokenHook: z.string().max(500).optional().nullable(),
  onScreenText: z.string().max(200).optional().nullable(),
  searchKeywords: z.array(z.string().max(80)).max(12).optional().nullable(),
  emailSubject: z.string().max(200).optional().nullable(),
  emailPreview: z.string().max(300).optional().nullable(),
  htmlBody: z.string().max(50_000).optional().nullable(),
  ctaUrl: z.string().max(2000).optional().nullable(),
  /** Queue dispatches leave the parent drop status for the queue to finalise. */
  keepEntityStatus: z.boolean().optional(),
})

export type SocialPublishRequest = z.infer<typeof socialPublishRequestSchema>

export type PublishedMediaIds = {
  instagram?: string
  instagram_story?: string
  facebook?: string
  tiktok?: string
  [key: string]: string | undefined
}

export type SocialConnectionRow = {
  id: string
  entity_id: string
  platform: SocialPlatform
  account_id: string
  access_token: string
  account_name: string
  is_active: boolean
  updated_at?: string
  created_at?: string
}

/** Safe client-facing connection (never includes raw access_token). */
export type SocialConnectionPublic = {
  id: string
  entity_id: string
  platform: SocialPlatform
  account_id: string
  account_name: string
  is_active: boolean
  token_configured: boolean
  token_preview: string
  updated_at: string
  created_at: string
}

export function parsePublishedMediaIds(value: unknown): PublishedMediaIds {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: PublishedMediaIds = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry.trim()) out[key] = entry.trim()
  }
  return out
}

/** Map API placement (incl. carousel) onto Graph-supported placements. */
export function normalizePublishPlacement(
  placement: PublishPlacementInput | undefined
): PublishPlacement {
  if (placement === "story") return "story"
  // Carousel → single feed photo until multi-child carousel lands.
  return "feed"
}

export function normalizeBrandKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  )
}

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    const host = url.hostname.toLowerCase()
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local")
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}

export function siteOrigin(): string {
  return getRequestOrigin()
}

/** Public origin for /r/ short links (FÜDI consumer domain vs MAD Studio ops domain). */
export function trackablePublicOrigin(input?: {
  entityId?: string | null
  websiteUrl?: string | null
}): string {
  if (input?.entityId === FUDI_ENTITY_ID) return FUDI_PUBLIC_ORIGIN
  const website = input?.websiteUrl?.trim() ?? ""
  if (website && /fudi\.nz/i.test(website)) return FUDI_PUBLIC_ORIGIN
  return siteOrigin()
}

export function trackableUrl(
  slug: string,
  entityId?: string | null,
  websiteUrl?: string | null
): string {
  return `${trackablePublicOrigin({ entityId, websiteUrl })}/r/${encodeURIComponent(slug)}`
}

export function appendUtmParams(
  destinationUrl: string,
  input?: { source?: string; medium?: string; campaign?: string }
): string {
  const url = new URL(destinationUrl)
  if (!url.searchParams.has("utm_source")) {
    url.searchParams.set("utm_source", input?.source ?? "social")
  }
  if (!url.searchParams.has("utm_medium")) {
    url.searchParams.set("utm_medium", input?.medium ?? "story")
  }
  if (input?.campaign && !url.searchParams.has("utm_campaign")) {
    url.searchParams.set("utm_campaign", input.campaign)
  }
  return url.toString()
}

export function createTrackableSlug(seed?: string): string {
  const base = (seed ?? "drop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base || "drop"}-${rand}`
}

export function metaGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION?.trim() || "v21.0"
}

export function metaGraphBase(): string {
  return `https://graph.facebook.com/${metaGraphVersion()}`
}
