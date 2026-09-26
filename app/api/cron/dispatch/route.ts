import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { processScheduledPosts } from "@/lib/scheduling/process-scheduled-posts"
import { resolveAppOrigin } from "@/lib/social/publish-campaign"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function runDispatch(request: Request) {
  const expected = process.env.CRON_SECRET?.trim()
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    )
  }

  const header = request.headers.get("authorization") ?? ""
  const provided = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : ""
  if (!provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processScheduledPosts({
      ctx: { origin: resolveAppOrigin(), secret: expected },
      limit: 25,
    })
    return NextResponse.json({
      processed: result.processed,
      successes: result.successes,
      failures: result.failures,
      errors: result.errors,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled dispatch failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runDispatch(request)
}

export async function POST(request: Request) {
  return runDispatch(request)
}
