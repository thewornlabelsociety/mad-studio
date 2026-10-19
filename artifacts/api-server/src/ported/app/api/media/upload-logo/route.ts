import { HttpResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const metaSchema = z.object({
  entityId: z.string().uuid(),
})

const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
}

/**
 * Store a brand's own logo (per entity) in entity-assets and return its public
 * URL. Story graphics stamp it in a corner.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const form = await request.formData()
    const file = form.get("file")
    const entityId = form.get("entityId")

    if (!(file instanceof File)) {
      return HttpResponse.json({ error: "file is required." }, { status: 400 })
    }

    const parsed = metaSchema.safeParse({
      entityId: typeof entityId === "string" ? entityId : "",
    })
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "entityId is required." },
        { status: 400 }
      )
    }

    const extension = LOGO_TYPES[file.type]
    if (!extension) {
      return HttpResponse.json(
        { error: "Logo must be a PNG, JPG, WebP or SVG." },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return HttpResponse.json(
        { error: "Logo too large (max 5MB)." },
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

    const buffer = Buffer.from(await file.arrayBuffer())
    const path = `logos/${parsed.data.entityId}/${Date.now()}-logo.${extension}`
    const { error: uploadError } = await supabase.storage
      .from("entity-assets")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return HttpResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("entity-assets").getPublicUrl(path)

    return HttpResponse.json({ logoUrl: publicUrl })
  } catch (error) {
    console.error("[media/upload-logo]", error)
    const message = error instanceof Error ? error.message : "Logo upload failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
