import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  TemplateAuthorizationError,
  TemplateConflictError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import { duplicateTemplateInstance } from "@/lib/templates/template-service"
import { duplicateTemplateRequestSchema } from "@/lib/templates/template-schema"

export const runtime = "nodejs"

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
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
    const body = duplicateTemplateRequestSchema.parse(await request.json())
    const instance = await duplicateTemplateInstance({
      supabase,
      userId: user.id,
      instanceId: params.id,
      entityId: body.entityId,
      name: body.name,
    })
    return NextResponse.json({ instance }, { status: 201 })
  } catch (error) {
    if (error instanceof TemplateIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof TemplateAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof TemplateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to duplicate template."
    const status = message.toLowerCase().includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
