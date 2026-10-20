import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import {
  loadCampaignProgramBundle,
  loadLatestCampaignProgramForEntity,
} from "@/lib/campaigns/persist-program-timeline"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const querySchema = z.object({
  entityId: z.string().uuid(),
  programId: z.string().uuid().optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      entityId: url.searchParams.get("entityId"),
      programId: url.searchParams.get("programId") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId query parameter is required." },
        { status: 400 }
      )
    }

    const { entityId, programId } = parsed.data

    const { data: canView, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )
    if (accessError || !canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const bundle = programId
      ? await loadCampaignProgramBundle({ programId, entityId })
      : await loadLatestCampaignProgramForEntity(entityId)

    if (!bundle) {
      return NextResponse.json({ program: null, days: [] })
    }

    return NextResponse.json({
      program: bundle.program,
      days: bundle.days,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load campaign program."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
