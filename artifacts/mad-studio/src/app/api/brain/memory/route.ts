import { NextResponse } from "next/server"
import { z } from "zod"

import { assertBrainEntityAccess } from "@/lib/brain/entity-access"
import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const memoryBodySchema = z.object({
  entityId: z.string().uuid(),
  text: z.string().trim().min(3).max(4000),
  title: z.string().trim().max(160).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const raw = await request.json()
    const parsed = memoryBodySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId and text are required." },
        { status: 400 }
      )
    }

    const { entityId, text, title } = parsed.data

    const access = await assertBrainEntityAccess({
      supabase,
      userId: user.id,
      entityId,
      mode: "edit",
    })
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const now = new Date().toISOString()
    const memoryTitle =
      title?.trim() || `Brain Memory · ${text.slice(0, 72)}`

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        entity_id: entityId,
        created_by: user.id,
        title: memoryTitle,
        target_goal: "memory_vault",
        status: "draft",
        outcome_rating: "winner",
        ai_takeaway: text,
        studio_context: {
          source: "brand_director_chat",
        } as unknown as Json,
        updated_at: now,
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save memory."
    console.error("[brain/memory]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
