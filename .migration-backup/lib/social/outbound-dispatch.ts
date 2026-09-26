import type { SocialConnectionRow, SocialPlatform } from "@/lib/social/types"
import { createAdminClient } from "@/lib/supabase/admin"

export const WLS_DEFAULT_ENTITY_ID =
  "ff62adda-3c81-421a-9c9a-e817d4169f74"

type DbClient = ReturnType<typeof createAdminClient> | {
  from: ReturnType<typeof createAdminClient>["from"]
}

export async function resolveOutboundWebhookUrl(
  supabase: DbClient,
  entityId: string
): Promise<string | null> {
  const { data: outbound } = await supabase
    .from("entity_channels")
    .select("webhook_url")
    .eq("entity_id", entityId)
    .eq("platform", "outbound")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (outbound?.webhook_url?.trim()) {
    return outbound.webhook_url.trim()
  }

  // Prefer any active channel webhook (tiktok / email / automation)
  const { data: anyChannel } = await supabase
    .from("entity_channels")
    .select("webhook_url")
    .eq("entity_id", entityId)
    .eq("is_active", true)
    .not("webhook_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return anyChannel?.webhook_url?.trim() || null
}

export async function resolveSocialConnection(input: {
  supabase: DbClient
  entityId: string
  platform: "instagram" | "facebook"
  connectionId?: string | null
}): Promise<SocialConnectionRow | null> {
  let query = input.supabase
    .from("social_connections")
    .select(
      "id, entity_id, platform, account_id, access_token, account_name, is_active, updated_at, created_at"
    )
    .eq("entity_id", input.entityId)
    .eq("platform", input.platform)
    .eq("is_active", true)

  if (input.connectionId) {
    query = query.eq("id", input.connectionId)
  } else {
    query = query.order("updated_at", { ascending: false }).limit(1)
  }

  const { data: connection } = await query.maybeSingle()
  if (
    connection?.access_token?.trim() &&
    connection.account_id?.trim()
  ) {
    return connection as SocialConnectionRow
  }

  return envFallbackConnection(input.entityId, input.platform)
}

function envFallbackConnection(
  entityId: string,
  platform: "instagram" | "facebook"
): SocialConnectionRow | null {
  const token = process.env.META_ACCESS_TOKEN?.trim()
  if (!token) return null

  if (platform === "instagram") {
    const accountId = process.env.WLS_INSTAGRAM_ACCOUNT_ID?.trim()
    if (!accountId) return null
    return {
      id: "env-wls-instagram",
      entity_id: entityId,
      platform: "instagram",
      account_id: accountId,
      access_token: token,
      account_name: "WLS Instagram (env)",
      is_active: true,
    }
  }

  const pageId = process.env.WLS_FACEBOOK_PAGE_ID?.trim()
  if (!pageId) return null
  return {
    id: "env-wls-facebook",
    entity_id: entityId,
    platform: "facebook",
    account_id: pageId,
    access_token: token,
    account_name: "WLS Facebook (env)",
    is_active: true,
  }
}

export async function postOutboundWebhook(input: {
  webhookUrl: string
  payload: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.payload),
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      return {
        ok: false,
        error: `Webhook responded ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`,
      }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Outbound webhook request failed.",
    }
  }
}

export async function sendVipEmailViaResend(input: {
  to: string[]
  subject: string
  previewText?: string
  htmlBody: string
  from?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." }
  }

  const from =
    input.from?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "MAD Studio <onboarding@resend.dev>"

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.htmlBody,
        text: input.previewText,
      }),
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string
      message?: string
      error?: { message?: string }
    }
    if (!response.ok) {
      return {
        ok: false,
        error:
          payload.error?.message ||
          payload.message ||
          `Resend responded ${response.status}`,
      }
    }
    return { ok: true, id: payload.id || "resend" }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Resend request failed.",
    }
  }
}

export function resolveVipEmailRecipients(entityId: string): string[] {
  const perEntity = process.env[`VIP_EMAIL_LIST_${entityId.replace(/-/g, "_").toUpperCase()}`]
  const global = process.env.VIP_EMAIL_TEST_LIST?.trim()
  const raw = perEntity?.trim() || global || ""
  return raw
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.includes("@"))
}

export function formatMetaDispatchError(message: string): {
  message: string
  status: number
} {
  const lower = message.toLowerCase()
  if (
    lower.includes("token") ||
    lower.includes("oauth") ||
    lower.includes("(code 190") ||
    lower.includes("expired")
  ) {
    return {
      message:
        message ||
        "Meta access token is invalid or expired. Update Social Connections or META_ACCESS_TOKEN.",
      status: 401,
    }
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("user request limit") ||
    lower.includes("(code 4") ||
    lower.includes("(code 17") ||
    lower.includes("(code 32")
  ) {
    return {
      message: `Meta rate limit hit — wait a moment and retry. ${message}`,
      status: 429,
    }
  }
  if (
    lower.includes("aspect") ||
    lower.includes("image_url") ||
    lower.includes("media") ||
    lower.includes("container") ||
    lower.includes("format")
  ) {
    return {
      message: `Meta rejected the media container (check aspect ratio / public HTTPS URL). ${message}`,
      status: 400,
    }
  }
  return { message, status: 500 }
}

export type { SocialPlatform }
