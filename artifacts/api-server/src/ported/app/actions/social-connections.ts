"use server"

import { revalidatePath } from "@server/http-response"
import { z } from "zod"

import type {
  SocialConnectionPublic,
  SocialPlatform,
} from "@/lib/social/types"
import { createClient } from "@/lib/supabase/server"

export type SocialActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const upsertSchema = z.object({
  entityId: z.string().uuid(),
  platform: z.enum(["instagram", "facebook", "tiktok"]),
  accountId: z.string().min(1).max(200),
  accessToken: z.string().min(1).max(5000).optional(),
  accountName: z.string().max(200).optional().default(""),
  connectionId: z.string().uuid().optional().nullable(),
  keepExistingToken: z.boolean().optional().default(false),
})

function maskToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return "Not set"
  if (trimmed.length <= 8) return "••••••••"
  return `••••${trimmed.slice(-4)}`
}

function toPublic(row: {
  id: string
  entity_id: string
  platform: string
  account_id: string
  account_name: string
  access_token: string
  is_active: boolean
  updated_at: string
  created_at: string
}): SocialConnectionPublic {
  return {
    id: row.id,
    entity_id: row.entity_id,
    platform: row.platform as SocialPlatform,
    account_id: row.account_id,
    account_name: row.account_name,
    is_active: row.is_active,
    token_configured: Boolean(row.access_token?.trim()),
    token_preview: maskToken(row.access_token ?? ""),
    updated_at: row.updated_at,
    created_at: row.created_at,
  }
}

async function assertCanManage(entityId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." }
  }

  const { data: canManage, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager", "creator"],
  })
  if (error) {
    return { supabase, user, error: error.message }
  }
  if (!canManage) {
    return {
      supabase,
      user,
      error: "You need creator or manager access to manage social connections.",
    }
  }
  return { supabase, user, error: null as null }
}

export async function listSocialConnections(input: {
  entityId: string
}): Promise<SocialActionResult<SocialConnectionPublic[]>> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data, error } = await auth.supabase
    .from("social_connections")
    .select(
      "id, entity_id, platform, account_id, account_name, access_token, is_active, updated_at, created_at"
    )
    .eq("entity_id", input.entityId)
    .order("platform", { ascending: true })

  if (error) {
    return { ok: false, error: error.message }
  }

  return {
    ok: true,
    data: (data ?? []).map(toPublic),
  }
}

export async function upsertSocialConnection(
  input: z.infer<typeof upsertSchema>
): Promise<SocialActionResult<SocialConnectionPublic>> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "Invalid social connection payload." }
  }

  const payload = parsed.data
  const auth = await assertCanManage(payload.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const now = new Date().toISOString()
  const accountId = payload.accountId.trim()
  const accountName = payload.accountName?.trim() || ""
  const nextToken = payload.accessToken?.trim() || ""

  if (payload.connectionId) {
    const { data: existing, error: existingError } = await auth.supabase
      .from("social_connections")
      .select("id, access_token")
      .eq("id", payload.connectionId)
      .eq("entity_id", payload.entityId)
      .maybeSingle()

    if (existingError || !existing) {
      return {
        ok: false,
        error: existingError?.message ?? "Connection not found.",
      }
    }

    const accessToken =
      nextToken ||
      (payload.keepExistingToken ? existing.access_token : "")
    if (!accessToken) {
      return { ok: false, error: "Access token is required." }
    }

    const { data, error } = await auth.supabase
      .from("social_connections")
      .update({
        platform: payload.platform,
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        is_active: true,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("entity_id", payload.entityId)
      .select(
        "id, entity_id, platform, account_id, account_name, access_token, is_active, updated_at, created_at"
      )
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update connection." }
    }

    revalidatePath("/settings/social")
    return { ok: true, data: toPublic(data) }
  }

  if (!nextToken) {
    return { ok: false, error: "Access token is required for a new connection." }
  }

  const { data: existingSame } = await auth.supabase
    .from("social_connections")
    .select("id")
    .eq("entity_id", payload.entityId)
    .eq("platform", payload.platform)
    .eq("account_id", accountId)
    .maybeSingle()

  if (existingSame) {
    const { data, error } = await auth.supabase
      .from("social_connections")
      .update({
        account_name: accountName,
        access_token: nextToken,
        is_active: true,
        updated_at: now,
      })
      .eq("id", existingSame.id)
      .select(
        "id, entity_id, platform, account_id, account_name, access_token, is_active, updated_at, created_at"
      )
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update connection." }
    }
    revalidatePath("/settings/social")
    return { ok: true, data: toPublic(data) }
  }

  // Deactivate prior active rows for this platform so one primary connection wins.
  await auth.supabase
    .from("social_connections")
    .update({ is_active: false, updated_at: now })
    .eq("entity_id", payload.entityId)
    .eq("platform", payload.platform)
    .eq("is_active", true)

  const { data, error } = await auth.supabase
    .from("social_connections")
    .insert({
      entity_id: payload.entityId,
      platform: payload.platform,
      account_id: accountId,
      account_name: accountName,
      access_token: nextToken,
      is_active: true,
      updated_at: now,
    })
    .select(
      "id, entity_id, platform, account_id, account_name, access_token, is_active, updated_at, created_at"
    )
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save connection." }
  }

  revalidatePath("/settings/social")
  return { ok: true, data: toPublic(data) }
}

export async function deactivateSocialConnection(input: {
  entityId: string
  connectionId: string
}): Promise<SocialActionResult> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { error } = await auth.supabase
    .from("social_connections")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
    .eq("entity_id", input.entityId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/settings/social")
  return { ok: true, data: undefined }
}

export async function getOutboundWebhook(input: {
  entityId: string
}): Promise<SocialActionResult<{ webhookUrl: string | null; channelId: string | null }>> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data, error } = await auth.supabase
    .from("entity_channels")
    .select("id, webhook_url")
    .eq("entity_id", input.entityId)
    .eq("platform", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: {
      webhookUrl: data?.webhook_url ?? null,
      channelId: data?.id ?? null,
    },
  }
}

export async function upsertOutboundWebhook(input: {
  entityId: string
  webhookUrl: string
}): Promise<SocialActionResult<{ webhookUrl: string }>> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const webhookUrl = input.webhookUrl.trim()
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl)
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { ok: false, error: "Webhook URL must be http(s)." }
      }
    } catch {
      return { ok: false, error: "Enter a valid webhook URL." }
    }
  }

  const existing = await getOutboundWebhook({ entityId: input.entityId })
  if (!existing.ok) return existing

  if (existing.data.channelId) {
    const { error } = await auth.supabase
      .from("entity_channels")
      .update({
        webhook_url: webhookUrl || null,
        account_name: "Make / n8n Outbound",
        is_active: Boolean(webhookUrl),
        credentials: { type: "outbound_webhook" },
      })
      .eq("id", existing.data.channelId)
      .eq("entity_id", input.entityId)
    if (error) return { ok: false, error: error.message }
  } else if (webhookUrl) {
    const { error } = await auth.supabase.from("entity_channels").insert({
      entity_id: input.entityId,
      platform: "outbound",
      account_name: "Make / n8n Outbound",
      webhook_url: webhookUrl,
      credentials: { type: "outbound_webhook" },
      is_active: true,
    })
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath("/settings/social")
  return { ok: true, data: { webhookUrl } }
}

export async function testOutboundWebhook(input: {
  entityId: string
}): Promise<SocialActionResult<{ ok: true }>> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const listed = await getOutboundWebhook({ entityId: input.entityId })
  if (!listed.ok) return listed
  const webhookUrl = listed.data.webhookUrl?.trim()
  if (!webhookUrl) {
    return { ok: false, error: "Save a webhook URL before sending a test ping." }
  }

  const { postOutboundWebhook } = await import("@/lib/social/outbound-dispatch")
  const result = await postOutboundWebhook({
    webhookUrl,
    payload: {
      platform: "test",
      event: "webhook.ping",
      entityId: input.entityId,
      timestamp: new Date().toISOString(),
      message: "MAD Studio outbound webhook test ping",
    },
  })
  if (!result.ok) return { ok: false, error: result.error }

  await auth.supabase.from("activity_logs").insert({
    entity_id: input.entityId,
    user_id: auth.user.id,
    action: "webhook_test_ping",
    details: { webhook_url: webhookUrl },
  })

  return { ok: true, data: { ok: true } }
}

export async function ensureInventoryTrackableLink(input: {
  entityId: string
  marketingEntityId: string
  destinationUrl?: string | null
  /** Override slug seed (e.g. fudi-dish or partner-venue). */
  titleSeed?: string | null
}): Promise<SocialActionResult<{ slug: string; shortUrl: string }>> {
  const auth = await assertCanManage(input.entityId)
  if (auth.error || !auth.user) {
    return { ok: false, error: auth.error ?? "Unauthorized" }
  }

  const { data: item, error: itemError } = await auth.supabase
    .from("marketing_entities")
    .select("id, title, trackable_slug, website_item_id")
    .eq("id", input.marketingEntityId)
    .eq("entity_id", input.entityId)
    .maybeSingle()

  if (itemError || !item) {
    return { ok: false, error: itemError?.message ?? "Inventory item not found." }
  }

  const { data: entity } = await auth.supabase
    .from("entities")
    .select("website_url")
    .eq("id", input.entityId)
    .maybeSingle()

  let destination = input.destinationUrl?.trim() || ""
  if (!destination) {
    const { resolveItemDestinationUrl } = await import(
      "@/lib/marketing/story-presets"
    )
    destination =
      resolveItemDestinationUrl({
        entityId: input.entityId,
        websiteUrl: entity?.website_url,
        websiteItemId: item.website_item_id,
        copyDraft: item.copy_draft,
      }) || ""
  }

  if (!destination) {
    return {
      ok: false,
      error: "Set a destination URL or brand website_url before creating a shortlink.",
    }
  }

  const { ensureTrackableLink } = await import("@/lib/social/link-tracker")

  const link = await ensureTrackableLink({
    entityId: input.entityId,
    marketingEntityId: item.id,
    destinationUrl: destination,
    existingSlug: item.trackable_slug,
    titleSeed: input.titleSeed?.trim() || item.title,
    utmMedium: "story",
  })

  if (item.trackable_slug !== link.slug) {
    await auth.supabase
      .from("marketing_entities")
      .update({
        trackable_slug: link.slug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("entity_id", input.entityId)
  }

  revalidatePath(`/inventory/${item.id}`)
  return {
    ok: true,
    data: { slug: link.slug, shortUrl: link.shortUrl },
  }
}
