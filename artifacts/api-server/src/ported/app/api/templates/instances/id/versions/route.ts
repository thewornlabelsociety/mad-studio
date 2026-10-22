import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { TemplateIsolationError } from "@/lib/templates/template-engine"
import { listTemplateVersions } from "@/lib/templates/template-service"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = paramsSchema.parse(await context.params)
    const url = new URL(request.url)
    const entityId = url.searchParams.get("entityId")
    if (!entityId || !z.string().uuid().safeParse(entityId).success) {
      return NextResponse.json(
        { error: "entityId query parameter is required." },
        { status: 400 }
      )
    }

    const versions = await listTemplateVersions({
      supabase,
      userId: user.id,
      entityId,
      instanceId: params.id,
    })
    return NextResponse.json({ versions })
  } catch (error) {
    if (error instanceof TemplateIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to list versions."
    const status = message.toLowerCase().includes("not found") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
