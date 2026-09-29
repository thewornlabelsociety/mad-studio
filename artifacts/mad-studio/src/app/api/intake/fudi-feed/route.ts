import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

import {
  fudiFeedRequestSchema,
  isFudiSupabaseSyncRequest,
} from "@/lib/inventory/fudi-feed"
import { upsertFudiFeedWebhookItem } from "@/lib/inventory/fudi-marketing-intake"
import { syncFudiSupabaseToMarketingEntities } from "@/lib/inventory/fudi-supabase-sync"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function extractIntakeSecret(request: Request): string | null {
  const headerSecret = request.headers.get("x-fudi-feed-secret")
  if (headerSecret?.trim()) return headerSecret.trim()
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
    process.env.FUDI_FEED_WEBHOOK_SECRET?.trim() ??
    process.env.SYNC_WEBHOOK_SECRET?.trim() ??
    null
  )
}

function hasValidWebhookSecret(request: Request): boolean {
  const expected = webhookSecretConfigured()
  if (!expected) return false
  const provided = extractIntakeSecret(request)
  if (!provided) return false
  return secretsMatch(provided, expected)
}

async function authorizeFudiSync(request: Request): Promise<{
  ok: true
  userId: string | null
} | { ok: false; status: number; error: string }> {
  if (hasValidWebhookSecret(request)) {
    return { ok: true, userId: null }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const { data: canEdit, error: accessError } = await supabase.rpc(
    "has_entity_access",
    {
      ent_id: FUDI_ENTITY_ID,
      allowed_roles: ["entity_manager", "creator"],
    }
  )
  if (accessError) {
    return { ok: false, status: 500, error: accessError.message }
  }
  if (!canEdit) {
    return {
      ok: false,
      status: 403,
      error: "You need creator or manager access on FÜDI to pull the app feed.",
    }
  }

  return { ok: true, userId: user.id }
}

async function resolveEntityId(
  admin: ReturnType<typeof createAdminClient>,
  entityId: string | undefined,
  entitySlug: string | undefined
): Promise<string | null> {
  if (entityId) return entityId
  const slug = (entitySlug ?? "fudi").trim()
  const { data: byId } = await admin
    .from("entities")
    .select("id")
    .eq("id", FUDI_ENTITY_ID)
    .maybeSingle()
  if (byId?.id && (slug.toLowerCase() === "fudi" || slug.toLowerCase() === "füdi")) {
    return byId.id
  }
  const { data: byName } = await admin
    .from("entities")
    .select("id")
    .ilike("name", slug)
    .limit(1)
    .maybeSingle()
  return byName?.id ?? null
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const parsed = fudiFeedRequestSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid FÜDI feed payload.", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const body = parsed.data
    const syncMode =
      isFudiSupabaseSyncRequest(body) ||
      (Object.keys(rawBody).length === 0 && !body.item && !(body.items?.length))

    if (syncMode) {
      const auth = await authorizeFudiSync(request)
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
      }

      const admin = createAdminClient()
      const entityId = body.entity_id ?? FUDI_ENTITY_ID
      if (entityId !== FUDI_ENTITY_ID) {
        return NextResponse.json(
          { error: "FÜDI Supabase sync is scoped to the FÜDI entity only." },
          { status: 400 }
        )
      }

      const result = await syncFudiSupabaseToMarketingEntities({
        madAdmin: admin,
        entityId,
      })

      if (auth.userId) {
        const supabase = await createClient()
        await supabase.from("activity_logs").insert({
          entity_id: entityId,
          user_id: auth.userId,
          action: "fudi_supabase_pull",
          details: {
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
            scanned: result.scanned,
            sources: result.sources,
            probes: result.probes,
          },
        })
      }

      return NextResponse.json({
        ok: true,
        mode: "sync",
        entity_id: entityId,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        scanned: result.scanned,
        sources: result.sources,
        probes: result.probes,
        items: result.items,
        message:
          result.imported === 0
            ? "FÜDI app feed is up to date — no new drops to import."
            : `Successfully pulled ${result.imported} new drops & specials from FÜDI`,
      })
    }

    const expected = webhookSecretConfigured()
    if (!expected) {
      return NextResponse.json(
        { error: "FUDI_FEED_WEBHOOK_SECRET or SYNC_WEBHOOK_SECRET is not configured." },
        { status: 500 }
      )
    }

    if (!hasValidWebhookSecret(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const batch = [
      ...(body.item ? [body.item] : []),
      ...(body.items ?? []),
    ]
    if (batch.length === 0) {
      return NextResponse.json(
        { error: "Provide item or items to ingest, or { sync: true } to pull from FÜDI Supabase." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const entityId = await resolveEntityId(
      admin,
      body.entity_id,
      body.entity_slug
    )
    if (!entityId) {
      return NextResponse.json(
        { error: "FÜDI entity not found for intake." },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()
    const synced = []
    let imported = 0
    for (const item of batch) {
      const row = await upsertFudiFeedWebhookItem(admin, entityId, item, now)
      if (row.imported) imported += 1
      synced.push(row.row)
    }

    return NextResponse.json({
      ok: true,
      mode: "webhook",
      entity_id: entityId,
      count: synced.length,
      imported,
      items: synced,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "FÜDI feed intake failed."
    console.error("[intake/fudi-feed]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
