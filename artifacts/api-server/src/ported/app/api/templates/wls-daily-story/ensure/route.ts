import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  TemplateAuthorizationError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import { ensureWlsDailyStoryTemplate } from "@/lib/templates/wls-daily-story-setup"

export const runtime = "nodejs"

const bodySchema = z.object({
  entityId: z.string().uuid(),
})

/**
 * Controlled, idempotent setup for the WLS Daily New Arrival Story template.
 * Owner must invoke this explicitly — does not run on app boot.
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
      return NextResponse.json(
        { error: "entityId is required." },
        { status: 400 }
      )
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

    const result = await ensureWlsDailyStoryTemplate({
      supabase,
      userId: user.id,
      entityId: entity.id,
      brandName: entity.name,
      industry: entity.industry,
    })

    return NextResponse.json({
      ok: true,
      created: result.created,
      instance: result.instance,
      latestVersion: result.latestVersion,
      message: result.created
        ? "Created WLS — Daily New Arrival Story template."
        : "WLS — Daily New Arrival Story template already exists.",
    })
  } catch (error) {
    if (error instanceof TemplateIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof TemplateAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to ensure template."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
