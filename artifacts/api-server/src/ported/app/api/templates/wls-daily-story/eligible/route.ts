import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { selectWlsProductsForTemplates } from "@/lib/inventory/wls-product-eligibility"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      entityId: url.searchParams.get("entityId"),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId query parameter is required." },
        { status: 400 }
      )
    }

    const { data: canView, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: parsed.data.entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canView) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 })
    }

    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("id, name, industry, website_url")
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
            "Daily New Arrival Story eligibility is only available for Worn Label Society brands.",
        },
        { status: 403 }
      )
    }

    const result = await selectWlsProductsForTemplates({
      supabase,
      entityId: entity.id,
      websiteUrl: entity.website_url,
      template: "daily_story",
    })

    return NextResponse.json({
      ok: true,
      entityId: entity.id,
      websiteUrl: entity.website_url ?? null,
      syncedCount: result.catalog.length,
      selectableCount: result.catalog.filter((row) => row.feedSelectable).length,
      storySelectableCount: result.eligible.length,
      catalog: result.catalog,
      eligible: result.eligible,
      excluded: result.excluded,
      exclusionSummary: result.exclusionSummary,
      softWarningSummary: result.softWarningSummary,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load eligible products."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
