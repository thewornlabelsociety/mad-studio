import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { selectWlsProductsByIds } from "@/lib/inventory/wls-product-eligibility"
import { validateWlsDailyStoryStudioHandoff } from "@/lib/templates/wls-daily-story-studio-handoff"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const bodySchema = z.object({
  entityId: z.string().uuid(),
  templateInstanceId: z.string().uuid().optional(),
  marketingEntityIds: z.array(z.string().uuid()).min(1).max(5),
  surface: z.enum(["story", "feed"]).optional(),
})

/** Validate WLS Daily Story handoff and return ordered eligible products for Studio. */
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
            "Daily New Arrival Story handoff is only for Worn Label Society brands.",
        },
        { status: 403 }
      )
    }

    const surface = parsed.data.surface ?? "story"

    if (surface === "feed") {
      const { data: entityRow, error: entityRowError } = await supabase
        .from("entities")
        .select("id, website_url")
        .eq("id", parsed.data.entityId)
        .maybeSingle()
      if (entityRowError || !entityRow) {
        return NextResponse.json(
          { error: entityRowError?.message ?? "Brand not found." },
          { status: 404 }
        )
      }
      const selections = await selectWlsProductsByIds({
        supabase,
        entityId: parsed.data.entityId,
        websiteUrl: entityRow.website_url,
        template: "daily_story",
        marketingEntityIds: parsed.data.marketingEntityIds,
        pickSurface: "feed",
      })
      return NextResponse.json({
        ok: true,
        entityId: parsed.data.entityId,
        surface: "feed",
        selections,
      })
    }

    if (!parsed.data.templateInstanceId) {
      return NextResponse.json(
        { error: "templateInstanceId is required for Story handoff." },
        { status: 400 }
      )
    }

    const result = await validateWlsDailyStoryStudioHandoff({
      supabase,
      entityId: parsed.data.entityId,
      templateInstanceId: parsed.data.templateInstanceId,
      marketingEntityIds: parsed.data.marketingEntityIds,
    })

    return NextResponse.json({
      ok: true,
      entityId: parsed.data.entityId,
      surface: "story",
      template: result.template,
      selections: result.selections,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to validate handoff."
    const status =
      message.toLowerCase().includes("not found") ||
      message.toLowerCase().includes("eligible") ||
      message.toLowerCase().includes("requires") ||
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("supports up to")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
