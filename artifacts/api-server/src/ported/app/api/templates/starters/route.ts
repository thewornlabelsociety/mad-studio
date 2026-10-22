import { HttpResponse as NextResponse } from "@server/http-response"

import { createClient } from "@/lib/supabase/server"
import { listPublishedStarters } from "@/lib/templates/template-service"

export const runtime = "nodejs"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const starters = await listPublishedStarters(supabase)
    return NextResponse.json({ starters })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list starter templates."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
