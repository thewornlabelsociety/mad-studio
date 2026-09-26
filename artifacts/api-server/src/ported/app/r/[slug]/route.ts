import { HttpResponse } from "@server/http-response"

import {
  appendUtmParams,
} from "@/lib/social/types"
import { syncClicksIntoMarketingMetrics } from "@/lib/social/link-tracker"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

type RouteProps = {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, { params }: RouteProps) {
  const { slug: rawSlug } = await params
  const slug = decodeURIComponent(rawSlug || "").trim()

  if (!slug) {
    return HttpResponse.json({ error: "Missing slug." }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc("record_link_click", {
      p_slug: slug,
    })

    if (error) {
      return HttpResponse.json({ error: error.message }, { status: 500 })
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row || typeof row !== "object") {
      return HttpResponse.json({ error: "Link not found." }, { status: 404 })
    }

    const record = row as {
      destination_url?: string
      marketing_entity_id?: string
      click_count?: number
    }

    const destination = record.destination_url?.trim()
    if (!destination) {
      return HttpResponse.json({ error: "Link not found." }, { status: 404 })
    }

    if (
      typeof record.marketing_entity_id === "string" &&
      typeof record.click_count === "number"
    ) {
      void syncClicksIntoMarketingMetrics(
        record.marketing_entity_id,
        record.click_count
      ).catch(() => {
        /* non-blocking metrics mirror */
      })
    }

    const redirectTo = appendUtmParams(destination, {
      source: "social",
      medium: "story",
    })

    return HttpResponse.redirect(redirectTo, 302)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve short link."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
