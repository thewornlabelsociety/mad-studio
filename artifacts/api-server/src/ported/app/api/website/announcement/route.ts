import { HttpResponse as NextResponse } from "@server/http-response"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const bodySchema = z.object({
  entityId: z.string().uuid(),
  /** Our id for this announcement; sending it again updates the same one. */
  externalId: z.string().min(1).max(80),
  imageUrl: z.string().url(),
  headline: z.string().trim().min(1).max(120),
  body: z.string().trim().max(400).optional(),
  linkUrl: z.string().trim().max(500).optional(),
  linkLabel: z.string().trim().max(40).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
})

/**
 * Put an announcement card on the Worn Label Society website's home page.
 * The website keeps it (and hides it after endsAt); this only forwards it with
 * the shared key from WLS_WEBSITE_API_KEY, so the key never reaches a browser.
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
      return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    }
    const { entityId, ...announcement } = parsed.data
    if (!/^https:\/\//i.test(announcement.imageUrl)) {
      return NextResponse.json({ error: "Image must be a public https URL." }, { status: 400 })
    }

    const { data: canEdit, error: accessError } = await supabase.rpc("has_entity_access", {
      ent_id: entityId,
      allowed_roles: ["entity_manager", "creator"],
    })
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canEdit) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 })
    }

    const key = process.env.WLS_WEBSITE_API_KEY?.trim()
    if (!key) {
      return NextResponse.json(
        { error: "The website isn't connected yet (WLS_WEBSITE_API_KEY isn't set)." },
        { status: 501 }
      )
    }
    const site = (process.env.WLS_WEBSITE_URL?.trim() || "https://www.wornlabelsociety.co.nz").replace(/\/+$/, "")

    const response = await fetch(`${site}/api/marketing/home-announcements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ ...announcement, source: "mad-studio" }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string
      error?: string
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error || `The website said no (${response.status}).` },
        { status: 502 }
      )
    }
    return NextResponse.json({ ok: true, id: payload.id ?? null, siteUrl: site })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't reach the website." },
      { status: 500 }
    )
  }
}
