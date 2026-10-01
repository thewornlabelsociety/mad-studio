import { timingSafeEqual } from "crypto"
import { HttpResponse } from "@server/http-response"

import {
  ingestMobileDrop,
  mobileDropPayloadSchema,
} from "@/lib/inventory/mobile-drop-intake"
import { createAdminClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const maxDuration = 120

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractWebhookSecret(request: Request): string | null {
  const dedicated = request.headers.get("x-mobile-drop-secret")
  if (dedicated?.trim()) return dedicated.trim()
  const syncHeader = request.headers.get("x-sync-secret")
  if (syncHeader?.trim()) return syncHeader.trim()
  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim()
  }
  return null
}

function webhookSecretConfigured(): string | null {
  return (
    process.env.MOBILE_DROP_WEBHOOK_SECRET?.trim() ??
    process.env.SYNC_WEBHOOK_SECRET?.trim() ??
    process.env.CRON_SECRET?.trim() ??
    null
  )
}

export async function POST(request: Request) {
  try {
    const expected = webhookSecretConfigured()
    if (!expected) {
      return HttpResponse.json(
        { error: "MOBILE_DROP_WEBHOOK_SECRET is not configured." },
        { status: 500 }
      )
    }

    const provided = extractWebhookSecret(request)
    if (!provided || !secretsMatch(provided, expected)) {
      return HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const raw = await request.json().catch(() => null)
    const parsed = mobileDropPayloadSchema.safeParse(raw)
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "Invalid mobile drop payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: entity } = await admin
      .from("entities")
      .select("id")
      .eq("id", parsed.data.entityId)
      .maybeSingle()

    if (!entity?.id) {
      return HttpResponse.json({ error: "Unknown entityId." }, { status: 404 })
    }

    const result = await ingestMobileDrop(admin, parsed.data)

    return HttpResponse.json({
      ok: true,
      marketingEntityId: result.id,
      websiteItemId: result.website_item_id,
      images: result.images,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mobile drop intake failed."
    return HttpResponse.json({ error: message }, { status: 500 })
  }
}
