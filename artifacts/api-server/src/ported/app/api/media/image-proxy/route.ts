import { HttpResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { fetchPublicImage } from "@/lib/media/safe-image-fetch"

export const runtime = "nodejs"
export const maxDuration = 30

const querySchema = z.object({
  url: z.string().url(),
  entityId: z.string().uuid(),
})

/**
 * Auth-gated image proxy so the browser can run subject cutout on
 * cross-origin product photos without CORS failures.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      url: searchParams.get("url") ?? "",
      entityId: searchParams.get("entityId") ?? "",
    })
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "url and entityId are required." },
        { status: 400 }
      )
    }

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: parsed.data.entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError || !canEdit) {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let image: Awaited<ReturnType<typeof fetchPublicImage>>
    try {
      image = await fetchPublicImage(parsed.data.url)
    } catch {
      return HttpResponse.json(
        { error: "Could not fetch source image." },
        { status: 400 }
      )
    }

    return new HttpResponse(image.bytes, {
      status: 200,
      headers: {
        "Content-Type": image.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    console.error("[media/image-proxy]", error)
    const message =
      error instanceof Error ? error.message : "Image proxy failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
