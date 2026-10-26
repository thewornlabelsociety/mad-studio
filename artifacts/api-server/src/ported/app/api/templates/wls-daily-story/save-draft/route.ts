import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { saveWlsDailyStoryDraft } from "@/lib/templates/wls-daily-story-draft"

export const runtime = "nodejs"

const bodySchema = z.object({
  entityId: z.string().uuid(),
  marketingEntityId: z.string().uuid(),
  templateInstanceId: z.string().uuid(),
  templateVersionId: z.string().uuid().nullable().optional(),
  sourceImageUrl: z.string().url(),
  renderedUrl: z.string().url(),
})

/** Save a baked Daily Story as a draft. Never publishes or schedules. */
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
        { error: "Invalid draft payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
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

    const result = await saveWlsDailyStoryDraft({
      supabase,
      entityId: entity.id,
      brandName: entity.name,
      industry: entity.industry,
      websiteUrl: entity.website_url,
      marketingEntityId: parsed.data.marketingEntityId,
      templateInstanceId: parsed.data.templateInstanceId,
      templateVersionId: parsed.data.templateVersionId ?? null,
      sourceImageUrl: parsed.data.sourceImageUrl,
      renderedUrl: parsed.data.renderedUrl,
    })

    return NextResponse.json({
      ok: true,
      ...result,
      message: result.reusedExisting
        ? "Updated existing Daily Story draft (no duplicate created)."
        : "Saved Daily Story draft — approval required before publishing.",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save draft."
    const status =
      message.toLowerCase().includes("access") ||
      message.toLowerCase().includes("eligible") ||
      message.toLowerCase().includes("sold") ||
      message.toLowerCase().includes("unavailable")
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
