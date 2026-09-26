import { HttpResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const metaSchema = z.object({
  entityId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
})

/**
 * Persist a client-side cutout PNG (e.g. from @imgly/background-removal)
 * into entity-assets and return a public URL.
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
    const itemId = form.get("itemId")

    if (!(file instanceof File)) {
      return HttpResponse.json({ error: "file is required." }, { status: 400 })
    }

    const parsed = metaSchema.safeParse({
      entityId: typeof entityId === "string" ? entityId : "",
      itemId:
        typeof itemId === "string" && itemId.length > 0 ? itemId : undefined,
    })
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "entityId is required." },
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

    if (file.size > 12 * 1024 * 1024) {
      return HttpResponse.json(
        { error: "Cutout too large (max 12MB)." },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const path = `cutouts/${parsed.data.entityId}/${parsed.data.itemId ?? "item"}/${Date.now()}-cutout.png`
    const { error: uploadError } = await supabase.storage
      .from("entity-assets")
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: false,
      })

    if (uploadError) {
      return HttpResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("entity-assets").getPublicUrl(path)

    return HttpResponse.json({ transparentUrl: publicUrl, mode: "imgly" })
  } catch (error) {
    console.error("[media/upload-cutout]", error)
    const message =
      error instanceof Error ? error.message : "Cutout upload failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
