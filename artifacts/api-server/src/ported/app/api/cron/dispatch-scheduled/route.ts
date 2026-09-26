import { timingSafeEqual } from "crypto"
import { HttpResponse } from "@server/http-response"

import { dispatchDueScheduledDrops } from "@/lib/inventory/dispatch-due"

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
      return HttpResponse.json(
        { error: "CRON_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractCronSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await dispatchDueScheduledDrops({ limit: 25 })
    return HttpResponse.json({ ok: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduled dispatch failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runDispatch(request)
}

export async function POST(request: Request) {
  return runDispatch(request)
}
