import { readJsonBody } from "@/lib/http/safe-json"

import type {
  CarouselPromoAngle,
  CarouselSuggestItem,
} from "@/lib/today/carousel-suggest-types"

export async function requestCarouselPromoAngles(input: {
  entityId: string
  items: CarouselSuggestItem[]
}): Promise<{ angles: CarouselPromoAngle[] }> {
  let response: Response
  try {
    response = await fetch("/api/ai/carousel-suggest", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  } catch {
    throw new Error(
      "Could not reach the API server. Start it on port 8080 and retry."
    )
  }

  const parsed = await readJsonBody<{
    error?: string
    angles?: CarouselPromoAngle[]
  }>(response)

  if (!parsed.ok) {
    if (response.status === 404) {
      throw new Error(
        "Carousel suggest API is missing on port 8080. Restart the API server (pnpm --filter @workspace/api-server run start) and retry."
      )
    }
    throw new Error(parsed.error)
  }

  const payload = parsed.data
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Carousel suggest API is missing on port 8080. Restart the API server after a fresh build and retry."
      )
    }
    throw new Error(payload.error ?? `Suggest failed (${response.status}).`)
  }

  const angles = payload.angles ?? []
  if (angles.length === 0) {
    throw new Error("No promo angles returned.")
  }

  return { angles }
}
