import {
  parseStudioTemplateHandoffResponse,
  type StudioTemplateHandoffResponse,
} from "./studio-handoff-types"

export async function fetchStudioTemplateHandoff(input: {
  entityId: string
  templateInstanceId: string
  marketingEntityIds?: string[]
}): Promise<StudioTemplateHandoffResponse> {
  const res = await fetch("/api/templates/studio-handoff", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entityId: input.entityId,
      templateInstanceId: input.templateInstanceId,
      marketingEntityIds: input.marketingEntityIds,
    }),
  })
  const rawText = await res.text().catch(() => "")
  let data: { error?: string; kind?: string } = {}
  try {
    data = rawText ? (JSON.parse(rawText) as typeof data) : {}
  } catch {
    data = {}
  }
  if (!res.ok) {
    const expressMissing =
      rawText.includes("Cannot POST") ||
      rawText.includes("Cannot GET") ||
      rawText.includes("<!DOCTYPE")
    const detail =
      typeof data.error === "string" && data.error.trim()
        ? data.error.trim()
        : expressMissing || res.status === 404
          ? "Template handoff API is missing on the API server — restart api-server (pnpm dev in artifacts/api-server) so /api/templates/studio-handoff is registered."
          : rawText.trim().slice(0, 200) || `HTTP ${res.status}`
    throw new Error(`Could not apply template: ${detail}`)
  }
  try {
    return parseStudioTemplateHandoffResponse(data)
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not apply template: ${error.message}`
        : "Could not apply template: invalid server response."
    )
  }
}
