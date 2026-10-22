import { HttpResponse as NextResponse } from "@server/http-response"

import { createClient } from "@/lib/supabase/server"
import {
  TemplateAuthorizationError,
  TemplateConflictError,
  TemplateIsolationError,
} from "@/lib/templates/template-engine"
import { forkPlatformStarter } from "@/lib/templates/template-service"

export const runtime = "nodejs"

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
    const instance = await forkPlatformStarter({
      supabase,
      userId: user.id,
      body,
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
      error instanceof Error ? error.message : "Failed to fork starter template."
    const status = message.toLowerCase().includes("not found") ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
