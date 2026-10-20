import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { generateDayPackHeadless } from "@/lib/studio/headless-generator"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 120

const bodySchema = z.object({
  entityId: z.string().uuid(),
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

    const { entityId } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await generateDayPackHeadless({
      dayId,
      entityId,
      userId: user.id,
    })

    return NextResponse.json({
      ok: true,
      day: result.day,
      campaignId: result.snapshot.campaignId,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Headless pack generation failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
