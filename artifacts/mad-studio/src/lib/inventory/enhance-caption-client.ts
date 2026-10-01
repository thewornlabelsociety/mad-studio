import { readJsonBody } from "@/lib/http/safe-json"

export type EnhanceCaptionInput = {
  entityId: string
  marketingEntityId: string
  headline: string
  caption: string
  visualDescription?: string | null
}

export type EnhanceCaptionResult = {
  headline: string
  caption: string
}

export async function requestEnhanceCaption(
  input: EnhanceCaptionInput
): Promise<EnhanceCaptionResult> {
  let response: Response
  try {
    response = await fetch("/api/inventory/enhance-caption", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(
      "Could not reach the API server. Start it on port 8080 (pnpm --filter @workspace/api-server run start) and retry."
    )
  }

  const parsed = await readJsonBody<{
    error?: string
    headline?: string
    caption?: string
  }>(response)

  if (!parsed.ok) {
    throw new Error(parsed.error)
  }

  const payload = parsed.data
  if (!response.ok) {
    throw new Error(payload.error ?? `Enhance failed (${response.status}).`)
  }

  const headline = payload.headline?.trim() ?? ""
  const caption = payload.caption?.trim() ?? ""
  if (!headline || !caption) {
    throw new Error(payload.error ?? "Model returned empty copy.")
  }

  return { headline, caption }
}
