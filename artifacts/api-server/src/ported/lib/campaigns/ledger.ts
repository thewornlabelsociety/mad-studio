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

/** Rows created by POST /api/brain/memory (and memory_rule suggest) — not marketing drops. */
export const BRAIN_MEMORY_VAULT_GOAL = "memory_vault"

export function isBrainMemoryVaultCampaign(campaign: {
  target_goal: string | null
}): boolean {
  return campaign.target_goal === BRAIN_MEMORY_VAULT_GOAL
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

export type FinancialSummary = {
  moneySpent: number
  salesMade: number
  netProfit: number
  returnMultiplier: number | null
}

export function aggregateFinancialSummary(
  campaigns: CampaignLedgerItem[]
): FinancialSummary {
  let moneySpent = 0
  let salesMade = 0
  for (const campaign of campaigns) {
    moneySpent += Number(campaign.analytics?.spend ?? 0)
    salesMade += Number(campaign.analytics?.revenue ?? 0)
  }
  const netProfit = salesMade - moneySpent
  const returnMultiplier =
    moneySpent > 0 ? salesMade / moneySpent : salesMade > 0 ? null : 0
  return { moneySpent, salesMade, netProfit, returnMultiplier }
}

export type PublishedDropRow = {
  id: string
  title: string
  thumbnailUrl: string | null
  targetAudience: string | null
  ctrPercent: number | null
  directConversions: number
  costPerClick: number | null
  publishedAt: string | null
}

export function ctrFromMetrics(metrics: {
  views?: number
  clicks?: number
  impressions?: number
}): number | null {
  const impressions = Number(metrics.impressions ?? metrics.views ?? 0)
  const clicks = Number(metrics.clicks ?? 0)
  if (impressions <= 0) return null
  return (clicks / impressions) * 100
}

export const markWinnerSchema = z.object({
  campaignId: z.string().uuid(),
  entityId: z.string().uuid(),
  userTakeaway: z.string().min(8).max(500),
})

export type MarkWinnerInput = z.infer<typeof markWinnerSchema>

export function extractHookBlueprintFromPack(assetPack: unknown): string | null {
  if (!assetPack || typeof assetPack !== "object") return null
  const pack = assetPack as Record<string, unknown>
  const hooks = pack.creative_hooks
  if (hooks && typeof hooks === "object") {
    const row = hooks as Record<string, string>
    const first = row.vibe_styling || row.investment_condition || row.local_instore
    if (first?.trim()) return first.trim()
  }
  const signals = pack.algorithmic_signals
  if (signals && typeof signals === "object") {
    const spoken = (signals as Record<string, string>).spoken_hook
    if (spoken?.trim()) return spoken.trim()
  }
  return null
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
