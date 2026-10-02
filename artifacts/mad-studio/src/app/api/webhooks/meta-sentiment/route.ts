import { NextResponse } from "next/server"

import {
  processMetaSentimentWebhook,
  verifyMetaWebhookSignature,
} from "@/lib/brain/meta-sentiment-ingest"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 120

function verifyToken(): string | null {
  return (
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ??
    process.env.META_SENTIMENT_VERIFY_TOKEN?.trim() ??
    null
  )
}

function appSecret(): string | null {
  return (
    process.env.META_APP_SECRET?.trim() ??
    process.env.META_CLIENT_SECRET?.trim() ??
    null
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const expected = verifyToken()
  if (!expected) {
    return NextResponse.json(
      { error: "META_WEBHOOK_VERIFY_TOKEN is not configured." },
      { status: 500 }
    )
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return NextResponse.json({ error: "Verification failed." }, { status: 403 })
}

export async function POST(request: Request) {
  const secret = appSecret()
  if (!secret) {
    return NextResponse.json(
      { error: "META_APP_SECRET is not configured." },
      { status: 500 }
    )
  }

  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")

  if (!verifyMetaWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const summary = await processMetaSentimentWebhook(admin, payload)
    return NextResponse.json({ ok: true, ...summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
