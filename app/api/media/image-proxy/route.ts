import { NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

const querySchema = z.object({
  url: z.string().url(),
  entityId: z.string().uuid(),
})

/**
 * Auth-gated image proxy so the browser can run subject cutout on
 * cross-origin product photos without CORS failures.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      url: searchParams.get("url") ?? "",
      entityId: searchParams.get("entityId") ?? "",
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: "url and entityId are required." },
        { status: 400 }
      )
    }

    const { data: canEdit, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: parsed.data.entityId,
        allowed_roles: ["entity_manager", "creator"],
      }
    )
    if (accessError || !canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const upstream = await fetch(parsed.data.url, {
      headers: { Accept: "image/*" },
      redirect: "follow",
    })
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Could not fetch source image." },
        { status: 400 }
      )
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg"
    const bytes = await upstream.arrayBuffer()

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    })
  } catch (error) {
    console.error("[media/image-proxy]", error)
    const message =
      error instanceof Error ? error.message : "Image proxy failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
