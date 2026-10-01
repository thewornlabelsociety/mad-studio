import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { runAutonomousTriggers } from "@/lib/scheduling/autonomous-triggers"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

async function runTriggers(request: Request) {
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
    const admin = createAdminClient()
    const results = await runAutonomousTriggers({ admin })
    const created = results.filter((row) => row.created)
    return NextResponse.json({
      ok: true,
      evaluated: results.length,
      created: created.length,
      results,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Autonomous triggers failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return runTriggers(request)
}

export async function POST(request: Request) {
  return runTriggers(request)
}
