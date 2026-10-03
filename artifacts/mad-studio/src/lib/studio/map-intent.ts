import { z } from "zod"

import type { FudiDropKind } from "@/lib/today/agenda"

export const mapIntentAvailableOptionsSchema = z.object({
  dropTypes: z
    .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
    .optional(),
  listingVibes: z.array(z.string().min(1)),
  pillars: z.array(z.string().min(1)),
  audiencePersonas: z.array(z.string().min(1)),
  hookBlueprints: z.array(z.string().min(1)),
  ctas: z.array(z.string().min(1)),
})

export type MapIntentAvailableOptions = z.infer<
  typeof mapIntentAvailableOptionsSchema
>

/** Client-facing option lists (labels) + server-side id maps built in the route handler. */
export type MapIntentAvailableOptionsInternal = MapIntentAvailableOptions & {
  personaIdsByName: Record<string, string>
  hookIdsByLabel: Record<string, string>
  ctaIdsByLabel: Record<string, string>
  dropIdsByLabel: Record<string, string>
}

const mapIntentOptionSourceSchema = z.object({
  dropTypes: z
    .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
    .optional(),
  listingVibes: z.array(z.string().min(1)),
  pillars: z.array(z.string().min(1)),
  personas: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  hookBlueprints: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })),
  ctas: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })),
})

export const mapIntentRequestSchema = z.object({
  entityId: z.string().uuid(),
  visualDescription: z.string().max(4000),
  activeBrand: z.string().max(200),
  aestheticTags: z.array(z.string().max(80)).max(12).default([]),
  concreteFeatures: z.array(z.string().max(120)).max(16).default([]),
  optionSource: mapIntentOptionSourceSchema,
})

/** Model output — string label per dropdown (or Custom… + custom* companion). */
export const mapIntentModelSchema = z.object({
  dropType: z.string(),
  listingVibe: z.string(),
  contentPillar: z.string(),
  audiencePersona: z.string(),
  hookBlueprint: z.string(),
  cta: z.string(),
  customDropType: z.string().optional().nullable(),
  customListingVibe: z.string().optional().nullable(),
  customContentPillar: z.string().optional().nullable(),
})

export type MapIntentModelResult = z.infer<typeof mapIntentModelSchema>

export type MapIntentResult = {
  dropKind: FudiDropKind | null
  dropTypeCustom: string | null
  listingVibe: string
  listingVibeIsCustom: boolean
  contentPillar: string
  contentPillarIsCustom: boolean
  personaId: string
  hookBlueprintId: string
  ctaId: string
}

export type IntentAiSuggestedField =
  | "dropType"
  | "listingVibe"
  | "pillar"
  | "persona"
  | "hookBlueprint"
  | "cta"

function isCustomToken(value: string): boolean {
  return /^custom(?:\.\.\.)?\s*:?\s*$/i.test(value.trim())
}

function extractCustomValue(
  primary: string,
  explicit: string | null | undefined
): string {
  const fromField = explicit?.trim()
  if (fromField) return fromField
  const trimmed = primary.trim()
  const colon = trimmed.match(/^custom(?:\.\.\.)?\s*:\s*(.+)$/i)
  if (colon?.[1]) return colon[1].trim()
  if (/^custom(?:\.\.\.)?\s+/i.test(trimmed)) {
    return trimmed.replace(/^custom(?:\.\.\.)?\s*/i, "").trim()
  }
  return trimmed
}

function pickLabel(
  primary: string,
  explicitCustom: string | null | undefined,
  allowed: string[],
  fallback: string
): { value: string; isCustom: boolean } {
  if (isCustomToken(primary)) {
    return {
      value: extractCustomValue(primary, explicitCustom) || fallback,
      isCustom: true,
    }
  }
  const trimmed = primary.trim()
  if (allowed.includes(trimmed)) {
    return { value: trimmed, isCustom: false }
  }
  const lower = trimmed.toLowerCase()
  const match = allowed.find((row) => row.toLowerCase() === lower)
  if (match) return { value: match, isCustom: false }
  if (explicitCustom?.trim()) {
    return { value: explicitCustom.trim(), isCustom: true }
  }
  return { value: fallback, isCustom: false }
}

function pickIdByLabel(
  primary: string,
  labelToId: Record<string, string>,
  labels: string[],
  fallbackId: string
): string {
  const trimmed = primary.trim()
  if (labelToId[trimmed]) return labelToId[trimmed]
  const lower = trimmed.toLowerCase()
  for (const label of labels) {
    if (label.toLowerCase() === lower) return labelToId[label] ?? fallbackId
  }
  for (const label of labels) {
    if (
      label.toLowerCase().includes(lower) ||
      lower.includes(label.toLowerCase())
    ) {
      return labelToId[label] ?? fallbackId
    }
  }
  return fallbackId
}

export function buildMapIntentOptionLabels(input: {
  dropTypes?: Array<{ id: string; label: string }>
  listingVibes: string[]
  pillars: string[]
  personas: Array<{ id: string; name: string }>
  hookBlueprints: Array<{ id: string; label: string }>
  ctas: Array<{ id: string; label: string }>
}): {
  availableOptions: MapIntentAvailableOptions
  maps: Omit<MapIntentAvailableOptionsInternal, keyof MapIntentAvailableOptions>
} {
  const personaIdsByName: Record<string, string> = {}
  for (const row of input.personas) {
    personaIdsByName[row.name] = row.id
  }
  const hookIdsByLabel: Record<string, string> = {}
  for (const row of input.hookBlueprints) {
    hookIdsByLabel[row.label] = row.id
  }
  const ctaIdsByLabel: Record<string, string> = {}
  for (const row of input.ctas) {
    ctaIdsByLabel[row.label] = row.id
  }
  const dropIdsByLabel: Record<string, string> = {}
  for (const row of input.dropTypes ?? []) {
    dropIdsByLabel[row.label] = row.id
  }

  return {
    availableOptions: {
      dropTypes: input.dropTypes,
      listingVibes: input.listingVibes,
      pillars: input.pillars,
      audiencePersonas: input.personas.map((row) => row.name),
      hookBlueprints: input.hookBlueprints.map((row) => row.label),
      ctas: input.ctas.map((row) => row.label),
    },
    maps: {
      personaIdsByName,
      hookIdsByLabel,
      ctaIdsByLabel,
      dropIdsByLabel,
    },
  }
}

export function coerceMapIntentResult(
  raw: MapIntentModelResult,
  options: MapIntentAvailableOptions,
  maps: Omit<MapIntentAvailableOptionsInternal, keyof MapIntentAvailableOptions>
): MapIntentResult {
  const pillarFallback = options.pillars[0] ?? "Brand story"
  const vibeFallback = options.listingVibes[0] ?? pillarFallback
  const personaNames = options.audiencePersonas
  const personaFallback =
    maps.personaIdsByName[personaNames[0] ?? ""] ?? ""
  const hookLabels = options.hookBlueprints
  const hookFallback = maps.hookIdsByLabel[hookLabels[0] ?? ""] ?? ""
  const ctaLabels = options.ctas
  const ctaFallback = maps.ctaIdsByLabel[ctaLabels[0] ?? ""] ?? ""

  const listing = pickLabel(
    raw.listingVibe,
    raw.customListingVibe,
    options.listingVibes,
    vibeFallback
  )
  const pillar = pickLabel(
    raw.contentPillar,
    raw.customContentPillar,
    options.pillars,
    pillarFallback
  )

  let dropKind: FudiDropKind | null = null
  let dropTypeCustom: string | null = null
  if (options.dropTypes?.length) {
    const dropLabels = options.dropTypes.map((row) => row.label)
    if (isCustomToken(raw.dropType) || raw.customDropType?.trim()) {
      dropTypeCustom =
        extractCustomValue(raw.dropType, raw.customDropType) || null
      dropKind = null
    } else {
      const id = pickIdByLabel(
        raw.dropType,
        maps.dropIdsByLabel,
        dropLabels,
        options.dropTypes[0]?.id ?? ""
      )
      dropKind = id as FudiDropKind
    }
  }

  const personaId = pickIdByLabel(
    raw.audiencePersona,
    maps.personaIdsByName,
    personaNames,
    personaFallback
  )
  const hookBlueprintId = pickIdByLabel(
    raw.hookBlueprint,
    maps.hookIdsByLabel,
    hookLabels,
    hookFallback
  )
  const ctaId = pickIdByLabel(
    raw.cta,
    maps.ctaIdsByLabel,
    ctaLabels,
    ctaFallback
  )

  return {
    dropKind,
    dropTypeCustom,
    listingVibe: listing.value,
    listingVibeIsCustom: listing.isCustom,
    contentPillar: pillar.value,
    contentPillarIsCustom: pillar.isCustom,
    personaId,
    hookBlueprintId,
    ctaId,
  }
}
