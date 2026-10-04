import { HttpResponse } from "@server/http-response"

import { pullNewArrivalsForEntity } from "@/lib/inventory/pull-arrivals"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entityId?: string
      feedUrl?: string
    }

    if (!body.entityId || typeof body.entityId !== "string") {
      return HttpResponse.json(
        { error: "entityId is required." },
        { status: 400 }
      )
    }

    const result = await pullNewArrivalsForEntity({
      entityId: body.entityId,
      feedUrl: body.feedUrl ?? null,
    })

    return HttpResponse.json({
      ok: true,
      imported: result.imported,
      skipped: result.skipped,
      feedUrl: result.feedUrl,
      items: result.items,
      emptyFeed: result.emptyFeed ?? false,
      message: result.emptyFeed
        ? "No live listings on the brand website right now — inventory is up to date."
        : result.imported === 0
          ? "No new arrivals — inventory already up to date."
          : `Imported ${result.imported} new arrival${result.imported === 1 ? "" : "s"}.`,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to pull new arrivals."
    const status =
      message === "Unauthorized"
        ? 401
        : message.toLowerCase().includes("access")
          ? 403
          : 500
    return HttpResponse.json({ error: message }, { status })
  }
}
