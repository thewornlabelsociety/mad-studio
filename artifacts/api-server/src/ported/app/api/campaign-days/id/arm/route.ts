import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { armDayPosts } from "@/lib/campaigns/arm-program-day"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  entityId: z.string().uuid(),
  force: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: dayId } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: "entityId is required." }, { status: 400 })
    }

    const { entityId, force } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await armDayPosts({
      dayId,
      entityId,
      userId: user.id,
      force,
    })

    return NextResponse.json({ ok: true, armed: result.armed, day: result.day })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Arming failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
