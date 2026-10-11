import { NextResponse } from "next/server"

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
      return NextResponse.json(
        { error: "entityId is required." },
        { status: 400 }
      )
    }

    const result = await pullNewArrivalsForEntity({
      entityId: body.entityId,
      feedUrl: body.feedUrl ?? null,
    })

    const pruned = result.pruned ?? 0
    const feedHint = result.feedUrl
      ? ` Source: ${result.feedUrl.replace(/^https?:\/\//, "").slice(0, 120)}`
      : ""

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      skipped: result.skipped,
      pruned,
      feedUrl: result.feedUrl,
      items: result.items,
      emptyFeed: result.emptyFeed ?? false,
      message: result.emptyFeed
        ? `No live listings on the brand website right now — intake cleared stale rows (${pruned} removed).${feedHint}`
        : result.imported === 0 && pruned === 0
          ? `No new arrivals — inventory already matches the live catalog.${feedHint}`
          : [
              result.imported > 0
                ? `Imported ${result.imported} new arrival${result.imported === 1 ? "" : "s"}.`
                : null,
              pruned > 0
                ? `Removed ${pruned} sold or delisted drop${pruned === 1 ? "" : "s"} from intake.`
                : null,
            ]
              .filter(Boolean)
              .join(" ") + feedHint,
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
    return NextResponse.json({ error: message }, { status })
  }
}
