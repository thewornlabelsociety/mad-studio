import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  TemplateAuthorizationError,
  TemplateConflictError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import {
  getEntityTemplateInstance,
  updateTemplateInstance,
} from "@/lib/templates/template-service"

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

    const instance = await getEntityTemplateInstance({
      supabase,
      userId: user.id,
      entityId,
      instanceId: params.id,
    })
    if (!instance) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ instance })
  } catch (error) {
    if (error instanceof TemplateIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to load template."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
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
    const body = await request.json()
    const instance = await updateTemplateInstance({
      supabase,
      userId: user.id,
      instanceId: params.id,
      body,
    })
    return NextResponse.json({ instance })
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
      error instanceof Error ? error.message : "Failed to update template."
    const status = message.toLowerCase().includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
