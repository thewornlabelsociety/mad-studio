import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { refreshAllExpiringTikTokConnections } from "@/lib/social/tiktok-token-refresh"

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
    return header.slice(7).trim()
  }
  return request.headers.get("x-cron-secret")?.trim() || null
}

async function runRefresh(request: Request) {
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

  try {
    const result = await refreshAllExpiringTikTokConnections()
    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "TikTok token refresh cron failed.",
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return runRefresh(request)
}

export async function POST(request: Request) {
  return runRefresh(request)
}
