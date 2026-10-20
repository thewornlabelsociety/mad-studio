import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { orchestrateProgramByAutonomy } from "@/lib/campaigns/orchestrate-program"
import { loadCampaignProgramBundle } from "@/lib/campaigns/persist-program-timeline"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 300

const bodySchema = z.object({
  programId: z.string().uuid(),
  entityId: z.string().uuid(),
  maxDays: z.number().int().min(1).max(10).optional(),
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

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "programId and entityId are required." },
        { status: 400 }
      )
    }

    const { programId, entityId, maxDays } = parsed.data

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      { ent_id: entityId, allowed_roles: ["entity_manager", "creator"] }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bundle = await loadCampaignProgramBundle({ programId, entityId })
    if (!bundle) {
      return NextResponse.json({ error: "Program not found." }, { status: 404 })
    }

    const result = await orchestrateProgramByAutonomy({
      programId,
      entityId,
      userId: user.id,
      maxDays,
    })

    return NextResponse.json({
      ok: true,
      program: {
        id: bundle.program.id,
        title: bundle.program.title,
        autonomy_mode: bundle.program.autonomy_mode,
      },
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Orchestration failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
