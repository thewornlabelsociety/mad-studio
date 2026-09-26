import type { AiModelRef, AiProvider } from "@/lib/ai/orchestrator"
import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"

export type AgentType =
  | "multiplexer"
  | "website_intake"
  | "post_mortem"
  | "media_inspect"

export type TokenUsage = {
  promptTokens: number
  completionTokens: number
}

export type MeteringParams = {
  entityId: string
  agentType: AgentType
  agentLabel: string
  modelUsed: string
  provider?: AiProvider | string
  promptTokens: number
  completionTokens: number
  durationMs: number
  summary?: string
  metadata?: Record<string, unknown>
}

/** Normalize Vercel AI SDK usage shapes into prompt/completion token counts. */
export function extractTokenUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: 0, completionTokens: 0 }
  }

  const record = usage as Record<string, unknown>
  const promptTokens = toNonNegInt(
    record.promptTokens ??
      record.inputTokens ??
      record.prompt_tokens ??
      record.input_tokens
  )
  const completionTokens = toNonNegInt(
    record.completionTokens ??
      record.outputTokens ??
      record.completion_tokens ??
      record.output_tokens
  )

  return { promptTokens, completionTokens }
}

function toNonNegInt(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.round(num)
}

function envFallbackRates(modelUsed: string): {
  provider: string
  inputRate: number
  outputRate: number
} {
  const inputEnv = process.env.AI_DEFAULT_INPUT_COST_PER_MILLION_USD
  const outputEnv = process.env.AI_DEFAULT_OUTPUT_COST_PER_MILLION_USD
  const providerGuess = modelUsed.toLowerCase().includes("claude")
    ? "anthropic"
    : modelUsed.toLowerCase().includes("gpt")
      ? "openai"
      : "google"

  return {
    provider: providerGuess,
    inputRate: parseFloat(inputEnv || "0.10"),
    outputRate: parseFloat(outputEnv || "0.40"),
  }
}

export async function recordAgentCallTelemetry({
  entityId,
  agentType,
  agentLabel,
  modelUsed,
  provider: providerHint,
  promptTokens,
  completionTokens,
  durationMs,
  summary = "",
  metadata = {},
}: MeteringParams): Promise<void> {
  try {
    const supabase = await createClient()

    const { data: pricing } = await supabase
      .from("ai_model_pricing")
      .select("provider, input_cost_per_million_usd, output_cost_per_million_usd")
      .eq("model_id", modelUsed)
      .maybeSingle()

    const fallback = envFallbackRates(modelUsed)
    const inputRate = Number(
      pricing?.input_cost_per_million_usd ?? fallback.inputRate
    )
    const outputRate = Number(
      pricing?.output_cost_per_million_usd ?? fallback.outputRate
    )
    const provider =
      providerHint ?? pricing?.provider ?? fallback.provider

    const inputCostUsd = (promptTokens / 1_000_000) * inputRate
    const outputCostUsd = (completionTokens / 1_000_000) * outputRate
    const rawCostUsd = inputCostUsd + outputCostUsd

    const usdToNzdRate = parseFloat(
      process.env.CURRENCY_USD_TO_NZD_RATE || "1.65"
    )
    const rawCostNzd = rawCostUsd * usdToNzdRate

    const { error } = await supabase.from("entity_agent_metering").insert({
      entity_id: entityId,
      agent_type: agentType,
      agent_label: agentLabel,
      model_used: modelUsed,
      provider,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      raw_cost_usd: Number(rawCostUsd.toFixed(6)),
      raw_cost_nzd: Number(rawCostNzd.toFixed(6)),
      duration_ms: Math.max(0, Math.round(durationMs)),
      summary: summary.slice(0, 300),
      metadata: metadata as Json,
    })

    if (error) {
      console.warn("[Telemetry Warning] Failed to insert metering row:", error.message)
    }
  } catch (err) {
    console.warn("[Telemetry Warning] Failed to log agent metering:", err)
  }
}

export async function recordOrchestratedCall(input: {
  entityId: string
  agentType: AgentType
  agentLabel: string
  model: AiModelRef
  usage: unknown
  durationMs: number
  summary?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const tokens = extractTokenUsage(input.usage)
  await recordAgentCallTelemetry({
    entityId: input.entityId,
    agentType: input.agentType,
    agentLabel: input.agentLabel,
    modelUsed: input.model.modelId,
    provider: input.model.provider,
    promptTokens: tokens.promptTokens,
    completionTokens: tokens.completionTokens,
    durationMs: input.durationMs,
    summary: input.summary,
    metadata: input.metadata,
  })
}
