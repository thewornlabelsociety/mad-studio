import {
  entityDnaSchema,
  normalizeWebsiteUrl,
  type EntityDna,
} from "@/lib/entities/dna-schema"
import { buildWebsiteDnaExtractionPrompt, mergeForbiddenWords } from "@/lib/ai/prompts"
import {
  generateObjectWithFallback,
  type AiModelRef,
} from "@/lib/ai/orchestrator"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import { visualPresetsFromTheme } from "@/lib/brands/visual-presets"

const JINA_TIMEOUT_MS = 25_000
const MAX_PAGE_CHARS = 24_000

function jinaReaderUrl(cleanUrl: string): string {
  const endpoint = process.env.JINA_AI_READER_ENDPOINT?.trim()
  if (!endpoint) {
    return `https://r.jina.ai/${cleanUrl}`
  }
  if (endpoint.includes("{url}")) {
    return endpoint.replace("{url}", encodeURIComponent(cleanUrl))
  }
  const base = endpoint.replace(/\/$/, "")
  if (cleanUrl.startsWith("http") && endpoint.includes(cleanUrl)) {
    return endpoint
  }
  return `${base}/${cleanUrl}`
}

async function fetchWithJina(cleanUrl: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS)
  const apiKey = process.env.JINA_AI_API_KEY?.trim()

  try {
    const response = await fetch(jinaReaderUrl(cleanUrl), {
      method: "GET",
      headers: {
        Accept: "text/plain",
        "X-Target-Selector": "body",
        ...(apiKey
          ? {
              Authorization: `Bearer ${apiKey}`,
              "X-API-Key": apiKey,
            }
          : {}),
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        `Website extraction failed (${response.status}). Check the URL and try again.`
      )
    }

    const text = await response.text()
    if (!text.trim()) {
      throw new Error("No readable content was extracted from that website.")
    }

    return text.slice(0, MAX_PAGE_CHARS)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Website extraction timed out. Try again.")
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function sanitizeExtractedDna(brandName: string, dna: EntityDna): EntityDna {
  const profile = resolveIndustryProfile({
    name: brandName,
    industry: dna.industry,
  })
  const vibes =
    dna.brand_identity.vibes && dna.brand_identity.vibes.length > 0
      ? dna.brand_identity.vibes
      : profile.vibeTags
  const visualPresets =
    dna.brand_identity.visual_presets ?? visualPresetsFromTheme(profile.theme)

  return {
    ...dna,
    brand_identity: {
      ...dna.brand_identity,
      vibes,
      tagline: dna.brand_identity.tagline || profile.tagline,
      visual_presets: visualPresets,
      forbidden_words: mergeForbiddenWords(
        dna.brand_identity.forbidden_words,
        profile.forbiddenWords
      ),
    },
    content_pillars:
      dna.content_pillars.length > 0
        ? dna.content_pillars
        : profile.contentPillars,
    value_propositions:
      Object.keys(dna.value_propositions).length > 0
        ? dna.value_propositions
        : profile.valuePropositions,
  }
}

export async function extractDnaFromWebsite(input: {
  name: string
  url: string
}): Promise<{
  dna: EntityDna
  sourceUrl: string
  model: AiModelRef
  usage: unknown
}> {
  const sourceUrl = normalizeWebsiteUrl(input.url)
  const pageText = await fetchWithJina(sourceUrl)

  const { object, model, usage } = await generateObjectWithFallback({
    schema: entityDnaSchema,
    schemaName: "EntityDna",
    schemaDescription:
      "Client brand DNA matrix extracted from website copy for customer-facing voice",
    prompt: buildWebsiteDnaExtractionPrompt({
      brandName: input.name,
      sourceUrl,
      pageText,
    }),
  })

  return {
    dna: sanitizeExtractedDna(input.name, object),
    sourceUrl,
    model,
    usage,
  }
}
