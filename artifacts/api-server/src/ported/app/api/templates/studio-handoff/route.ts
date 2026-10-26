import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { resolveStudioTemplateHandoff } from "@/lib/templates/studio-handoff"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const bodySchema = z.object({
  entityId: z.string().uuid(),
  templateInstanceId: z.string().uuid(),
  marketingEntityIds: z.array(z.string().uuid()).max(5).optional(),
})

/** Resolve template → Create Studio handoff (generic brief or WLS product seed). */
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
        { error: "Invalid handoff payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: canManage, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: parsed.data.entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canManage) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 })
    }

    const result = await resolveStudioTemplateHandoff({
      supabase,
      userId: user.id,
      entityId: parsed.data.entityId,
      templateInstanceId: parsed.data.templateInstanceId,
      marketingEntityIds: parsed.data.marketingEntityIds,
    })

    if (result.kind === "wls_daily_story") {
      const { data: entity, error: entityError } = await supabase
        .from("entities")
        .select("id, name, industry")
        .eq("id", parsed.data.entityId)
        .maybeSingle()

      if (entityError || !entity) {
        return NextResponse.json(
          { error: entityError?.message ?? "Brand not found." },
          { status: 404 }
        )
      }

      if (
        !isWornLabelFashionEntity({
          name: entity.name,
          industry: entity.industry,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "Daily New Arrival Story is only for Worn Label Society brands.",
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Template handoff failed."
    const status =
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("eligible") ||
      message.toLowerCase().includes("requires") ||
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("supports up") ||
      message.toLowerCase().includes("isolation")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
