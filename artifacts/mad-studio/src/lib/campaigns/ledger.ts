import { z } from "zod"

export const logAnalyticsSchema = z.object({
  campaignId: z.string().uuid(),
  entityId: z.string().uuid(),
  spend: z.number().min(0),
  revenue: z.number().min(0),
  conversionsCount: z.number().int().min(0),
  impressions: z.number().int().min(0).optional().default(0),
  clicks: z.number().int().min(0).optional().default(0),
  notes: z.string().max(2000).optional().nullable(),
})

export type LogAnalyticsInput = z.infer<typeof logAnalyticsSchema>

export const outcomeRatingSchema = z.enum(["winner", "consistent", "loss"])

export type OutcomeRating = z.infer<typeof outcomeRatingSchema>

export const postMortemSchema = z.object({
  campaignId: z.string().uuid(),
  entityId: z.string().uuid(),
  outcomeRating: outcomeRatingSchema,
  whatWorked: z.string().max(4000).optional().default(""),
  whatDidntWork: z.string().max(4000).optional().default(""),
})

export type PostMortemInput = z.infer<typeof postMortemSchema>

export type AnalyticsSnapshot = {
  id: string
  campaign_id: string
  entity_id: string
  spend: number
  revenue: number
  conversions_count: number
  impressions: number | null
  clicks: number | null
  net_profit: number | null
  roas: number | null
  cpa: number | null
  ctr: number | null
  cpc: number | null
  notes: string | null
  reporting_date: string
}

export type CampaignLedgerItem = {
  id: string
  title: string
  status: string | null
  target_goal: string
  target_segment: string | null
  created_at: string
  published_at: string | null
  outcome_rating: string | null
  what_worked: string | null
  what_didnt_work: string | null
  ai_takeaway: string | null
  asset_pack: unknown
  analytics: AnalyticsSnapshot | null
  queue: CampaignQueuePost[]
}

/** A `public.scheduled_posts` row as shown in the campaigns ledger. */
export type CampaignQueuePost = {
  id: string
  campaign_id: string | null
  marketing_entity_id: string | null
  platform: string
  mode: string
  status: string
  scheduled_time: string
  published_at: string | null
  last_error: string | null
  attempts: number
}

export function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMultiplier(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  return `${amount.toFixed(2)}x`
}

export function channelLabelFromAssetPack(assetPack: unknown): string {
  if (!assetPack || typeof assetPack !== "object") {
    return "Modular Pack"
  }
  const pack = assetPack as Record<string, unknown>
  const modules = [
    pack.short_video ? "Video" : null,
    pack.carousel ? "Carousel" : null,
    pack.seo_caption ? "Caption" : null,
    pack.email_drop ? "Email" : null,
    pack.b2b_dm ? "B2B DM" : null,
  ].filter(Boolean)
  return modules.length > 0 ? modules.join(" · ") : "Modular Pack"
}
