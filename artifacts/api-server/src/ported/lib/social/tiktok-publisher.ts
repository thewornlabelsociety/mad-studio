import { createAdminClient } from "@/lib/supabase/admin"

type DbClient = ReturnType<typeof createAdminClient> | {
  from: ReturnType<typeof createAdminClient>["from"]
}

const TIKTOK_API = "https://open.tiktokapis.com/v2"
/** Unaudited / sandbox apps must post as private until TikTok approves the client. */
const TIKTOK_POST_PRIVACY = "SELF_ONLY" as const

export type TikTokConnection = {
  id: string
  accountId: string
  accountName: string
  accessToken: string
}

export type TikTokPublishResult =
  | { ok: true; publishId: string; privacyLevel: string; mediaType: "VIDEO" | "PHOTO" }
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
    .select("id, account_id, account_name, access_token")
    .eq("entity_id", entityId)
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.access_token?.trim()) return null
  return {
    id: data.id,
    accountId: data.account_id,
    accountName: data.account_name,
    accessToken: data.access_token.trim(),
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

/** Direct Post via the TikTok Content Posting API, pulling media from a public URL. */
export async function publishToTikTok(input: {
  accessToken: string
  mediaUrl: string
  caption: string
}): Promise<TikTokPublishResult> {
  const video = isVideoUrl(input.mediaUrl)

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
            source_info: { source: "PULL_FROM_URL", video_url: input.mediaUrl },
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
              photo_images: [input.mediaUrl],
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
