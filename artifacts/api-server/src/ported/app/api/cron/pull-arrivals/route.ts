import { timingSafeEqual } from "crypto"
import { HttpResponse } from "@server/http-response"

import { recordCronHeartbeat } from "@/lib/cron/record-heartbeat"
import { resolveInventoryIntakeMode } from "@/lib/inventory/entity-intake"
import {
  hasOwnArrivalFeed,
  pullNewArrivalsAsSystem,
} from "@/lib/inventory/pull-arrivals"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Pulls new stock for every brand with its own shop feed (website intake
 * mode, e.g. Worn Label Society). Food-feed brands (FÜDI) are skipped: their
 * pull falls back to Instagram and stays on the manual Refresh button.
 */
async function runPullArrivals(request: Request) {
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) {
    return HttpResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    )
  }

  const header = request.headers.get("authorization") ?? ""
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : ""
  if (!provided || !secretsMatch(provided, expected)) {
    return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const { data: entities, error } = await admin
      .from("entities")
      .select("id, name, industry, website_url")
      .order("name")
    if (error) throw new Error(error.message)

    const targets = (entities ?? []).filter(
      (entity) =>
        resolveInventoryIntakeMode(entity) === "website" &&
        hasOwnArrivalFeed({
          websiteUrl: entity.website_url,
          entityName: entity.name,
        })
    )

    const results: Array<{
      entityId: string
      name: string
      ok: boolean
      imported?: number
      updated?: number
      pruned?: number
      feedUrl?: string
      error?: string
    }> = []

    for (const entity of targets) {
      try {
        const result = await pullNewArrivalsAsSystem({ entityId: entity.id })
        results.push({
          entityId: entity.id,
          name: entity.name,
          ok: true,
          imported: result.imported,
          updated: result.updated,
          pruned: result.pruned,
          feedUrl: result.feedUrl,
        })
      } catch (pullError) {
        results.push({
          entityId: entity.id,
          name: entity.name,
          ok: false,
          error:
            pullError instanceof Error ? pullError.message : "Pull failed.",
        })
      }
    }

    const failed = results.filter((row) => !row.ok)
    const imported = results.reduce((sum, row) => sum + (row.imported ?? 0), 0)

    await recordCronHeartbeat({
      jobName: "pull-arrivals",
      status: failed.length > 0 ? "error" : "ok",
      detail: {
        entities: results.length,
        imported,
        failures: failed.map((row) => `${row.name}: ${row.error}`),
      },
    })

    return HttpResponse.json({
      ok: failed.length === 0,
      entities: results.length,
      imported,
      results,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "New arrivals pull failed."
    await recordCronHeartbeat({
      jobName: "pull-arrivals",
      status: "error",
      detail: { message },
    })
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runPullArrivals(request)
}

export async function POST(request: Request) {
  return runPullArrivals(request)
}
