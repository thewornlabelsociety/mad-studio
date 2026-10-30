import { HttpResponse as NextResponse } from "@server/http-response"

import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

/** The website's contact fields worth showing on an opening hours post. */
const FIELDS = [
  "hours_weekday",
  "hours_thursday",
  "hours_friday",
  "hours_saturday",
  "hours_sunday",
  "hours_public_holiday",
  "location",
  "location_detail",
] as const

/**
 * The Worn Label Society website's opening hours, as set on its Contact page.
 * The site serves them in its public config; this reads them server side so
 * the browser isn't blocked by cross-site rules.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const site = (process.env.WLS_WEBSITE_URL?.trim() || "https://www.wornlabelsociety.co.nz").replace(/\/+$/, "")
    const response = await fetch(`${site}/api/website-config`, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) {
      return NextResponse.json({ error: `The website said no (${response.status}).` }, { status: 502 })
    }
    const config = (await response.json().catch(() => null)) as { contact?: Record<string, unknown> } | null
    const contact: Record<string, string> = {}
    for (const field of FIELDS) {
      const value = config?.contact?.[field]
      if (typeof value === "string" && value.trim()) contact[field] = value
    }
    return NextResponse.json({ contact, siteUrl: site })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't reach the website." },
      { status: 502 }
    )
  }
}
