import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  TemplateAuthorizationError,
  TemplateConflictError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import {
  createCreativeRecipe,
  listCreativeRecipes,
} from "@/lib/templates/template-service"

export const runtime = "nodejs"

const listQuerySchema = z.object({
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
    const parsed = listQuerySchema.safeParse({
      entityId: url.searchParams.get("entityId"),
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId query parameter is required." },
        { status: 400 }
      )
    }

    const recipes = await listCreativeRecipes({
      supabase,
      userId: user.id,
      entityId: parsed.data.entityId,
    })
    return NextResponse.json({ recipes })
  } catch (error) {
    if (error instanceof TemplateIsolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    const message =
      error instanceof Error ? error.message : "Failed to list recipes."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const recipe = await createCreativeRecipe({
      supabase,
      userId: user.id,
      body,
    })
    return NextResponse.json({ recipe }, { status: 201 })
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
      error instanceof Error ? error.message : "Failed to create recipe."
    const status = message.toLowerCase().includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
