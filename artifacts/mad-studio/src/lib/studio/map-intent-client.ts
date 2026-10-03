import { readJsonBody } from "@/lib/http/safe-json"
import type { MapIntentResult } from "@/lib/studio/map-intent"

export type MapIntentOptionSource = {
  dropTypes?: Array<{ id: string; label: string }>
  listingVibes: string[]
  pillars: string[]
  personas: Array<{ id: string; name: string }>
  hookBlueprints: Array<{ id: string; label: string }>
  ctas: Array<{ id: string; label: string }>
}

export async function requestMapIntentFromMedia(input: {
  entityId: string
  visualDescription: string
  activeBrand: string
  aestheticTags?: string[]
  concreteFeatures?: string[]
  optionSource: MapIntentOptionSource
}): Promise<MapIntentResult> {
  const response = await fetch("/api/brain/map-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entityId: input.entityId,
      visualDescription: input.visualDescription,
      activeBrand: input.activeBrand,
      aestheticTags: input.aestheticTags ?? [],
      concreteFeatures: input.concreteFeatures ?? [],
      optionSource: input.optionSource,
    }),
  })
  const parsed = await readJsonBody<{ error?: string } & Partial<MapIntentResult>>(
    response
  )
  if (!parsed.ok) throw new Error(parsed.error)
  const payload = parsed.data
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not map intent from media.")
  }
  if (
    !payload.listingVibe ||
    !payload.contentPillar ||
    !payload.personaId ||
    !payload.hookBlueprintId ||
    !payload.ctaId
  ) {
    throw new Error("Incomplete intent mapping response.")
  }
  return payload as MapIntentResult
}
