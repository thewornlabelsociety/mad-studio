import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const bodySchema = z
  .object({
    entityId: z.string().uuid(),
    marketingEntityId: z.string().uuid(),
    /** true marks the Story shared from the phone; false clears it (undo). */
    shared: z.boolean().optional(),
    /** Background-removed PNG, kept so the item is only cut out once. */
    cutoutUrl: z.string().url().optional(),
  })
  .refine((body) => body.shared !== undefined || body.cutoutUrl !== undefined, {
    message: "Nothing to update.",
  })

/**
 * Small per-item Story state for the Today feed: whether the Story was shared,
 * and the saved cutout. Touches nothing else on the item.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    }
    const { entityId, marketingEntityId, shared, cutoutUrl } = parsed.data
    if (cutoutUrl && !/^https:\/\//i.test(cutoutUrl)) {
      return NextResponse.json({ error: "Cutout must be a public https URL." }, { status: 400 })
    }

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canEdit) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 })
    }

    const { data: row, error: readError } = await supabase
      .from("marketing_entities")
      .select("id, copy_draft")
      .eq("id", marketingEntityId)
      .eq("entity_id", entityId)
      .maybeSingle()
    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: "Product not found for this brand." }, { status: 404 })
    }

    const draft =
      row.copy_draft && typeof row.copy_draft === "object" && !Array.isArray(row.copy_draft)
        ? (row.copy_draft as Record<string, unknown>)
        : {}
    const metadata =
      draft.metadata && typeof draft.metadata === "object" && !Array.isArray(draft.metadata)
        ? (draft.metadata as Record<string, unknown>)
        : {}
    const nextMetadata: Record<string, unknown> = { ...metadata }
    if (shared !== undefined) {
      nextMetadata.wls_story_shared_at = shared ? new Date().toISOString() : null
    }
    if (cutoutUrl) nextMetadata.cutout_url = cutoutUrl
    const sharedAt =
      typeof nextMetadata.wls_story_shared_at === "string"
        ? nextMetadata.wls_story_shared_at
        : null

    const { error: updateError } = await supabase
      .from("marketing_entities")
      .update({
        copy_draft: { ...draft, metadata: nextMetadata } as unknown as Json,
      })
      .eq("id", marketingEntityId)
      .eq("entity_id", entityId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, sharedAt })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't update the Story." },
      { status: 500 }
    )
  }
}
