export type FieldAssistField = "hook" | "caption" | "tags"

import { readJsonBody } from "@/lib/http/safe-json"

export async function requestFieldAssist(input: {
  entityId: string
  marketingEntityId?: string | null
  field: FieldAssistField
  headline: string
  caption: string
  visualDescription?: string | null
  listingVibe?: string | null
  existingTags?: string[]
}): Promise<{ variations: string[]; tags: string[] }> {
  const response = await fetch("/api/ai/field-assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const parsed = await readJsonBody<{
    error?: string
    value?: string
    variations?: string[]
    tags?: string[]
  }>(response)
  if (!parsed.ok) throw new Error(parsed.error)
  const payload = parsed.data
  if (!response.ok) {
    throw new Error(payload.error ?? "AI assist failed.")
  }

  if (input.field === "tags") {
    const tags = (payload.tags ?? [])
      .map((row) => row.trim())
      .filter(Boolean)
    if (tags.length === 0) {
      throw new Error("Model returned no tags.")
    }
    return { variations: [], tags }
  }

  const variations = (payload.variations ?? (payload.value ? [payload.value] : []))
    .map((row) => row.trim())
    .filter(Boolean)
  if (variations.length === 0) {
    throw new Error("Model returned empty copy.")
  }
  return { variations, tags: [] }
}
