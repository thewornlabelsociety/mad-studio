import { HttpResponse } from "@server/http-response"
import { z } from "zod"

import { loadCampaignLedgerData } from "@/lib/campaigns/load-ledger-data"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const querySchema = z.object({
  entityId: z.string().uuid(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      entityId: url.searchParams.get("entityId"),
    })
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "entityId query parameter is required." },
        { status: 400 }
      )
    }

    const { entityId } = parsed.data

    const { data: canView, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError) {
      return HttpResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canView) {
      return HttpResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = await loadCampaignLedgerData(supabase, entityId)
    return HttpResponse.json({ ok: true, ...payload })
  } catch (error) {
    return HttpResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load ledger.",
      },
      { status: 500 }
    )
  }
}
