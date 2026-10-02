import { createAdminClient } from "@/lib/supabase/admin"
import { refreshTikTokConnectionIfNeeded } from "@/lib/social/tiktok-token-refresh"

type DbClient = ReturnType<typeof createAdminClient> | {
  from: ReturnType<typeof createAdminClient>["from"]
}

const TIKTOK_API = "https://open.tiktokapis.com/v2"
/** Unaudited / sandbox apps must post as private until TikTok approves the client. */
const TIKTOK_POST_PRIVACY = "SELF_ONLY" as const
const CANONICAL_SITE = "https://madstudio.nz"

/** Wrap storage URLs so TikTok pulls from verified madstudio.nz, not supabase.co. */
export function tiktokVerifiedMediaUrl(originalMediaUrl: string): string {
  try {
    const parsed = new URL(originalMediaUrl)
    if (
      parsed.hostname === "madstudio.nz" &&
      parsed.pathname.startsWith("/api/media/proxy")
    ) {
      return originalMediaUrl
    }
  } catch {
    /* invalid — still attempt wrap below */
  }

  const base = (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
    if (!raw) return CANONICAL_SITE
    try {
      const url = new URL(raw)
      if (url.hostname === "madstudio.nz") return url.origin
    } catch {
      /* fall through */
    }
    return CANONICAL_SITE
  })()

  return `${base.replace(/\/$/, "")}/api/media/proxy?url=${encodeURIComponent(originalMediaUrl)}`
}

export type TikTokConnection = {
  id: string
  accountId: string
  accountName: string
  accessToken: string
}

export type TikTokPublishResult =
  | { ok: true; publishId: string; privacyLevel: string; mediaType: "VIDEO" | "PHOTO" }
  | { ok: false; error: string; status: number }

export type TikTokVerifyResult =
  | { ok: true; accountId: string; accountName: string; message: string }
  | { ok: false; error: string; status: number }

type TikTokEnvelope<T> = {
  data?: T
  error?: { code?: string; message?: string; log_id?: string }
}

export async function resolveTikTokConnection(
  supabase: DbClient,
  entityId: string
): Promise<TikTokConnection | null> {
  const { data } = await supabase
    .from("social_connections")
    .select(
      "id, entity_id, account_id, account_name, access_token, refresh_token, token_expires_at"
    )
    .eq("entity_id", entityId)
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.access_token?.trim()) return null

  const fresh = await refreshTikTokConnectionIfNeeded(createAdminClient(), {
    id: data.id,
    entity_id: data.entity_id,
    account_id: data.account_id,
    account_name: data.account_name,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: data.token_expires_at,
  })
  if (!fresh.ok) {
    console.warn("[tiktok] token refresh before publish:", fresh.error)
    if (
      data.token_expires_at &&
      Date.parse(data.token_expires_at) < Date.now()
    ) {
      return null
    }
  }

  const accessToken = fresh.ok ? fresh.accessToken : data.access_token.trim()
  return {
    id: data.id,
    accountId: data.account_id,
    accountName: data.account_name,
    accessToken,
  }
}

function isVideoUrl(url: string): boolean {
  try {
    return /\.(mp4|mov|m4v|webm)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

async function tiktokPost<T>(
  path: string,
  accessToken: string,
  body: unknown
): Promise<{ status: number; envelope: TikTokEnvelope<T> }> {
  const response = await fetch(`${TIKTOK_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  const envelope = (await response.json().catch(() => ({}))) as TikTokEnvelope<T>
  return { status: response.status, envelope }
}

function describeError(envelope: TikTokEnvelope<unknown>, status: number): string {
  const code = envelope.error?.code
  if (code === "access_token_invalid" || code === "token_expired" || status === 401) {
    return "TikTok access token expired — reconnect TikTok under Settings → Social."
  }
  if (code === "url_ownership_unverified") {
    return "TikTok rejected the media URL: verify the media domain (URL prefix) in the TikTok developer portal."
  }
  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return "TikTok app is unaudited: posts must be private (SELF_ONLY) and the account set to private."
  }
  return `TikTok ${code ?? status}: ${envelope.error?.message || "publish failed"}`
}

export async function verifyTikTokConnection(input: {
  accessToken: string
  accountId: string
}): Promise<TikTokVerifyResult> {
  try {
    const response = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
      {
        headers: { Authorization: `Bearer ${input.accessToken}` },
        signal: AbortSignal.timeout(12_000),
      }
    )
    const payload = (await response.json().catch(() => ({}))) as TikTokEnvelope<{
      user?: { open_id?: string; display_name?: string }
    }>
    const code = payload.error?.code
    if (response.status >= 400 || (code && code !== "ok")) {
      return {
        ok: false,
        error: describeError(payload, response.status),
        status: response.status === 401 ? 401 : 400,
      }
    }
    const user = payload.data?.user
    const openId = user?.open_id ?? input.accountId
    const displayName = user?.display_name?.trim() || "TikTok Account"
    return {
      ok: true,
      accountId: openId,
      accountName: displayName,
      message: `TikTok verified — ${displayName} (${openId.slice(0, 8)}…).`,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `TikTok verify failed: ${error.message}`
          : "TikTok verify failed.",
      status: 502,
    }
  }
}

/** Direct Post via the TikTok Content Posting API, pulling media from a public URL. */
export async function publishToTikTok(input: {
  accessToken: string
  mediaUrl: string
  caption: string
}): Promise<TikTokPublishResult> {
  const video = isVideoUrl(input.mediaUrl)
  const mediaUrl = tiktokVerifiedMediaUrl(input.mediaUrl)

  try {
    const { status, envelope } = video
      ? await tiktokPost<{ publish_id?: string }>(
          "/post/publish/video/init/",
          input.accessToken,
          {
            post_info: {
              title: input.caption.slice(0, 2200),
              privacy_level: TIKTOK_POST_PRIVACY,
              disable_comment: false,
              disable_duet: false,
              disable_stitch: false,
            },
            source_info: { source: "PULL_FROM_URL", video_url: mediaUrl },
          }
        )
      : await tiktokPost<{ publish_id?: string }>(
          "/post/publish/content/init/",
          input.accessToken,
          {
            post_info: {
              title: input.caption.split("\n")[0].slice(0, 90),
              description: input.caption.slice(0, 4000),
              privacy_level: TIKTOK_POST_PRIVACY,
              disable_comment: false,
              auto_add_music: true,
            },
            source_info: {
              source: "PULL_FROM_URL",
              photo_cover_index: 0,
              photo_images: [mediaUrl],
            },
            post_mode: "DIRECT_POST",
            media_type: "PHOTO",
          }
        )

    const publishId = envelope.data?.publish_id
    const code = envelope.error?.code
    if (status >= 400 || (code && code !== "ok") || !publishId) {
      return {
        ok: false,
        error: describeError(envelope, status),
        status: status === 401 ? 401 : 502,
      }
    }
    return {
      ok: true,
      publishId,
      privacyLevel: TIKTOK_POST_PRIVACY,
      mediaType: video ? "VIDEO" : "PHOTO",
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? `TikTok request failed: ${error.message}` : "TikTok request failed.",
      status: 502,
    }
  }
}
