export type MeteringRange = "today" | "7d" | "30d" | "all"

export type MeteringRow = {
  id: string
  agent_type: string
  agent_label: string
  model_used: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  raw_cost_usd: number
  raw_cost_nzd: number
  duration_ms: number
  summary: string | null
  created_at: string
}

export type AgentBreakdown = {
  agentType: string
  agentLabel: string
  runs: number
  costNzd: number
  tokens: number
  avgLatencyMs: number
}

export type MeteringSummary = {
  totalCostNzd: number
  totalRuns: number
  avgCostPerRunNzd: number
  totalTokens: number
  avgLatencyMs: number
}

export type OperationalHealth = {
  packsGenerated: number
  campaignsLogged: number
  topHooks: Array<{
    campaignId: string
    title: string
    spokenHook: string
    roas: number
  }>
}

export function parseMeteringRange(value: string | undefined): MeteringRange {
  if (value === "today" || value === "7d" || value === "30d" || value === "all") {
    return value
  }
  return "7d"
}

export function rangeStartIso(range: MeteringRange, now = new Date()): string | null {
  if (range === "all") return null

  const start = new Date(now)
  if (range === "today") {
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }

  const days = range === "7d" ? 7 : 30
  start.setTime(start.getTime() - days * 24 * 60 * 60 * 1000)
  return start.toISOString()
}

export function summarizeMetering(rows: MeteringRow[]): MeteringSummary {
  const totalRuns = rows.length
  const totalCostNzd = rows.reduce((sum, row) => sum + Number(row.raw_cost_nzd), 0)
  const totalTokens = rows.reduce((sum, row) => sum + Number(row.total_tokens), 0)
  const totalLatency = rows.reduce((sum, row) => sum + Number(row.duration_ms), 0)

  return {
    totalCostNzd,
    totalRuns,
    avgCostPerRunNzd: totalRuns > 0 ? totalCostNzd / totalRuns : 0,
    totalTokens,
    avgLatencyMs: totalRuns > 0 ? totalLatency / totalRuns : 0,
  }
}

const AGENT_ORDER = ["multiplexer", "website_intake", "post_mortem"] as const

const DEFAULT_LABELS: Record<string, string> = {
  multiplexer: "Campaign Multiplexer",
  website_intake: "Deep Brain Intake (Scraper)",
  post_mortem: "Post-Mortem Trainer",
}

export function breakdownByAgent(rows: MeteringRow[]): AgentBreakdown[] {
  const map = new Map<string, AgentBreakdown>()

  for (const row of rows) {
    const existing = map.get(row.agent_type)
    if (existing) {
      existing.runs += 1
      existing.costNzd += Number(row.raw_cost_nzd)
      existing.tokens += Number(row.total_tokens)
      existing.avgLatencyMs += Number(row.duration_ms)
      continue
    }

    map.set(row.agent_type, {
      agentType: row.agent_type,
      agentLabel: row.agent_label || DEFAULT_LABELS[row.agent_type] || row.agent_type,
      runs: 1,
      costNzd: Number(row.raw_cost_nzd),
      tokens: Number(row.total_tokens),
      avgLatencyMs: Number(row.duration_ms),
    })
  }

  const result = Array.from(map.values()).map((item) => ({
    ...item,
    avgLatencyMs: item.runs > 0 ? item.avgLatencyMs / item.runs : 0,
  }))

  result.sort((a, b) => {
    const ai = AGENT_ORDER.indexOf(a.agentType as (typeof AGENT_ORDER)[number])
    const bi = AGENT_ORDER.indexOf(b.agentType as (typeof AGENT_ORDER)[number])
    const aRank = ai === -1 ? 99 : ai
    const bRank = bi === -1 ? 99 : bi
    if (aRank !== bRank) return aRank - bRank
    return b.costNzd - a.costNzd
  })

  return result
}

export function extractSpokenHook(signals: unknown): string | null {
  if (!signals || typeof signals !== "object") return null
  const hook = (signals as Record<string, unknown>).spoken_hook
  return typeof hook === "string" && hook.trim() ? hook.trim() : null
}

export function formatNzd(amount: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount)
}

export function formatTokens(n: number): string {
  return new Intl.NumberFormat("en-NZ").format(Math.round(n))
}

export function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatCompactTime(iso: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}
