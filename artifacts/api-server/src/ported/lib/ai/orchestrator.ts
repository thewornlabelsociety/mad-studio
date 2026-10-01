import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { generateObject, generateText, type LanguageModel } from "ai"
import type { z } from "zod"

export type AiProvider = "google" | "openai" | "anthropic"

export type AiModelRef = {
  /** Original env token, e.g. google:gemini-2.0-flash */
  raw: string
  provider: AiProvider
  modelId: string
}

/**
 * Parse `provider:model_id` or bare `model_id`.
 * Bare IDs are inferred: gemini-* → google, gpt-* → openai, claude-* → anthropic.
 */
export function parseAiModelToken(token: string): AiModelRef {
  const raw = token.trim().replace(/^["']|["']$/g, "")
  if (!raw) {
    throw new Error("Empty AI model token in environment cascade.")
  }

  // Accept provider/model as well as provider:model
  const normalized = raw.includes("/") && !raw.includes(":")
    ? raw.replace("/", ":")
    : raw

  const colon = normalized.indexOf(":")
  if (colon > 0) {
    const providerRaw = normalized.slice(0, colon).toLowerCase()
    const modelId = canonicalizeModelId(normalized.slice(colon + 1).trim())
    if (!modelId) {
      throw new Error(
        `Invalid AI model token "${raw}". Expected provider:model_id.`
      )
    }
    const provider = normalizeProvider(providerRaw)
    return { raw, provider, modelId }
  }

  const modelId = canonicalizeModelId(normalized)
  return {
    raw,
    provider: inferProviderFromModelId(modelId),
    modelId,
  }
}

/**
 * Map retired / aliased Google model IDs onto current generateContent endpoints.
 * Keeps older .env values from hard-failing with "models/... is not found".
 */
function canonicalizeModelId(modelId: string): string {
  const id = modelId.replace(/^models\//, "").trim()
  const aliases: Record<string, string> = {
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro-latest": "gemini-2.5-pro",
    "gemini-1.5-flash": "gemini-2.5-flash",
    "gemini-1.5-flash-latest": "gemini-2.5-flash",
    "gemini-1.5-flash-8b": "gemini-2.0-flash-lite",
    "gemini-pro": "gemini-2.5-pro",
    "gemini-pro-latest": "gemini-2.5-pro",
    "gemini-flash-latest": "gemini-2.5-flash",
    "gemini-flash-lite-latest": "gemini-2.0-flash-lite",
  }
  return aliases[id.toLowerCase()] ?? id
}

function normalizeProvider(value: string): AiProvider {
  if (value === "google" || value === "gemini" || value === "google-generative-ai") {
    return "google"
  }
  if (value === "openai" || value === "oai") {
    return "openai"
  }
  if (value === "anthropic" || value === "claude") {
    return "anthropic"
  }
  throw new Error(
    `Unknown AI provider "${value}". Use google, openai, or anthropic.`
  )
}

function inferProviderFromModelId(modelId: string): AiProvider {
  const id = modelId.toLowerCase()
  if (id.startsWith("gemini") || id.startsWith("models/gemini")) {
    return "google"
  }
  if (id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("o4")) {
    return "openai"
  }
  if (id.startsWith("claude")) {
    return "anthropic"
  }
  // Default to Google for historical MAD Studio setups
  return "google"
}

/**
 * Build the ordered candidate list exclusively from env:
 * AI_PRIMARY_MODEL → AI_FALLBACK_MODELS
 * Legacy GEMINI_API_MODEL is accepted as primary if AI_PRIMARY_MODEL is unset.
 */
export function getAiCandidateModels(): AiModelRef[] {
  const primaryToken =
    process.env.AI_PRIMARY_MODEL?.trim() ||
    process.env.GEMINI_API_MODEL?.trim() ||
    ""

  if (!primaryToken) {
    throw new Error(
      "AI_PRIMARY_MODEL is not configured. Set AI_PRIMARY_MODEL (and optional AI_FALLBACK_MODELS) in .env."
    )
  }

  const fallbackTokens = (process.env.AI_FALLBACK_MODELS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  const seen = new Set<string>()
  const cascade: AiModelRef[] = []

  for (const token of [primaryToken, ...fallbackTokens]) {
    const ref = parseAiModelToken(token)
    const key = `${ref.provider}:${ref.modelId}`
    if (seen.has(key)) continue
    seen.add(key)
    cascade.push(ref)
  }

  return cascade
}

function resolveLanguageModel(ref: AiModelRef): LanguageModel {
  switch (ref.provider) {
    case "google": {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (!apiKey) {
        throw new Error(
          "GOOGLE_GENERATIVE_AI_API_KEY is not configured for Google models."
        )
      }
      return createGoogleGenerativeAI({ apiKey })(ref.modelId)
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured for OpenAI models.")
      }
      return createOpenAI({ apiKey })(ref.modelId)
    }
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error(
          "ANTHROPIC_API_KEY is not configured for Anthropic models."
        )
      }
      return createAnthropic({ apiKey })(ref.modelId)
    }
  }
}

/** Resolve the primary env model for streaming chat routes. */
export function resolvePrimaryLanguageModel(): {
  model: LanguageModel
  ref: AiModelRef
} {
  const candidates = getAiCandidateModels()
  const preferred =
    candidates.find((ref) => /flash/i.test(ref.modelId)) ?? candidates[0]
  return { model: resolveLanguageModel(preferred), ref: preferred }
}

/**
 * Pick the first env-configured model that accepts a generateContent call.
 * Matches Teach Brain / suggest fallback order (AI_PRIMARY_MODEL → fallbacks).
 */
export async function resolveLanguageModelWithFallback(): Promise<{
  model: LanguageModel
  ref: AiModelRef
}> {
  const candidates = getAiCandidateModels()
  let lastError: unknown = null

  for (let index = 0; index < candidates.length; index += 1) {
    const ref = candidates[index]
    try {
      const model = resolveLanguageModel(ref)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await generateText({
        model,
        prompt: "OK",
        maxOutputTokens: 1,
        temperature: 0,
      } as any)
      return { model, ref }
    } catch (error) {
      lastError = error
      const capacity = isAiCapacityError(error)
      const missing = isAiModelNotFoundError(error)
      console.warn(
        `[ai] ${ref.provider}:${ref.modelId} unavailable for chat (${error instanceof Error ? error.message : String(error)}). Trying fallback…`
      )
      if (index < candidates.length - 1) {
        await sleep(capacity ? 600 * (index + 1) : missing ? 50 : 200)
      }
    }
  }

  if (isAiModelNotFoundError(lastError)) {
    throw new Error(
      "Configured AI models are unavailable for generateContent. Update AI_PRIMARY_MODEL / AI_FALLBACK_MODELS to current Gemini IDs (e.g. gemini-2.5-flash) and restart the API server."
    )
  }

  throw (
    lastError ??
    new Error("All model endpoints unavailable. Please try again.")
  )
}

export function isAiCapacityError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "")
  return /high demand|resource.?exhausted|429|unavailable|capacity|overloaded|quota|rate.?limit|try again later|503|529|too many requests/i.test(
    message
  )
}

export function isAiModelNotFoundError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : String(error ?? "")
  return /is not found|not supported for generateContent|ListModels|404|NOT_FOUND/i.test(
    message
  )
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

type ObjectArgs<SCHEMA extends z.ZodType> = {
  schema: SCHEMA
  /** Plain-text prompt (mutually exclusive with messages). */
  prompt?: string
  /** Multimodal / chat messages (preferred for vision). */
  messages?: unknown
  system?: string
  schemaName?: string
  schemaDescription?: string
  temperature?: number
  maxOutputTokens?: number
}

type TextArgs = {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
}

/**
 * Provider-agnostic structured generation with env-driven fallback cascade.
 */
export async function generateObjectWithFallback<SCHEMA extends z.ZodType>(
  args: ObjectArgs<SCHEMA>
): Promise<{
  object: z.infer<SCHEMA>
  model: AiModelRef
  usage: unknown
}> {
  if (!args.prompt && !args.messages) {
    throw new Error("generateObjectWithFallback requires prompt or messages.")
  }

  const candidates = getAiCandidateModels()
  let lastError: unknown = null

  for (let index = 0; index < candidates.length; index += 1) {
    const ref = candidates[index]
    try {
      const model = resolveLanguageModel(ref)
      // AI SDK overload variance — keep call flexible across providers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generateObject({
        model,
        schema: args.schema,
        ...(args.messages ? { messages: args.messages } : { prompt: args.prompt }),
        ...(args.system ? { system: args.system } : {}),
        ...(args.schemaName ? { schemaName: args.schemaName } : {}),
        ...(args.schemaDescription
          ? { schemaDescription: args.schemaDescription }
          : {}),
        ...(args.temperature !== undefined
          ? { temperature: args.temperature }
          : {}),
        ...(args.maxOutputTokens !== undefined
          ? { maxOutputTokens: args.maxOutputTokens }
          : {}),
      } as any)

      return {
        object: result.object as z.infer<SCHEMA>,
        model: ref,
        usage: result.usage ?? null,
      }
    } catch (error) {
      lastError = error
      const capacity = isAiCapacityError(error)
      const missing = isAiModelNotFoundError(error)
      console.warn(
        `[ai] ${ref.provider}:${ref.modelId} failed (${error instanceof Error ? error.message : String(error)}). Trying fallback…`
      )
      if (index < candidates.length - 1) {
        await sleep(capacity ? 600 * (index + 1) : missing ? 50 : 200)
      }
    }
  }

  if (isAiModelNotFoundError(lastError)) {
    throw new Error(
      "Configured AI models are unavailable for generateContent. Update AI_PRIMARY_MODEL / AI_FALLBACK_MODELS to current Gemini IDs (e.g. gemini-2.5-flash) and restart the dev server."
    )
  }

  throw (
    lastError ??
    new Error("All model endpoints unavailable. Please try again.")
  )
}

/**
 * Provider-agnostic text generation with env-driven fallback cascade.
 */
export async function generateTextWithFallback(
  args: TextArgs
): Promise<{ text: string; model: AiModelRef; usage: unknown }> {
  const candidates = getAiCandidateModels()
  let lastError: unknown = null

  for (let index = 0; index < candidates.length; index += 1) {
    const ref = candidates[index]
    try {
      const model = resolveLanguageModel(ref)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await generateText({
        model,
        prompt: args.prompt,
        ...(args.system ? { system: args.system } : {}),
        ...(args.temperature !== undefined
          ? { temperature: args.temperature }
          : {}),
        ...(args.maxOutputTokens !== undefined
          ? { maxOutputTokens: args.maxOutputTokens }
          : {}),
      } as any)

      return {
        text: result.text,
        model: ref,
        usage: result.usage ?? null,
      }
    } catch (error) {
      lastError = error
      const capacity = isAiCapacityError(error)
      const missing = isAiModelNotFoundError(error)
      console.warn(
        `[ai] ${ref.provider}:${ref.modelId} failed (${error instanceof Error ? error.message : String(error)}). Trying fallback…`
      )
      if (index < candidates.length - 1) {
        await sleep(capacity ? 600 * (index + 1) : missing ? 50 : 200)
      }
    }
  }

  if (isAiModelNotFoundError(lastError)) {
    throw new Error(
      "Configured AI models are unavailable for generateContent. Update AI_PRIMARY_MODEL / AI_FALLBACK_MODELS to current Gemini IDs (e.g. gemini-2.5-flash) and restart the dev server."
    )
  }

  throw (
    lastError ??
    new Error("All model endpoints unavailable. Please try again.")
  )
}
