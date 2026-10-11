import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { recordCronHeartbeat } from "@/lib/cron/record-heartbeat"
import { dispatchDueScheduledDrops } from "@/lib/inventory/dispatch-due"
import { processScheduledPosts } from "@/lib/scheduling/process-scheduled-posts"
import { resolveAppOrigin } from "@/lib/social/publish-campaign"

export const runtime = "nodejs"
export const maxDuration = 60

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractCronSecret(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null
  }
  return (
    request.headers.get("x-cron-secret")?.trim() ||
    request.headers.get("x-sync-secret")?.trim() ||
    null
  )
}

async function runDispatch(request: Request) {
  try {
    const expected =
      process.env.CRON_SECRET?.trim() ||
      process.env.SYNC_WEBHOOK_SECRET?.trim()
    if (!expected) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractCronSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const legacy = await dispatchDueScheduledDrops({ limit: 25 })
    const queue = await processScheduledPosts({
      ctx: { origin: resolveAppOrigin(), secret: expected },
      limit: 25,
    })

    const detail = {
      legacy,
      scheduled_posts: queue,
    }

    await recordCronHeartbeat({
      jobName: "dispatch-scheduled",
      status: "ok",
      detail: detail as Record<string, unknown>,
    })

    return NextResponse.json({
      ok: true,
      legacy,
      scheduled_posts: {
        processed: queue.processed,
        successes: queue.successes,
        failures: queue.failures,
        errors: queue.errors,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled dispatch failed."
    await recordCronHeartbeat({
      jobName: "dispatch-scheduled",
      status: "error",
      detail: { message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runDispatch(request)
}

export async function POST(request: Request) {
  return runDispatch(request)
}
