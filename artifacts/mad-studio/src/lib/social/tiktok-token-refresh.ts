import type { Database } from "@/lib/database.types"
import { tiktokClientKey, tiktokClientSecret } from "@/lib/social/tiktok-oauth"
import { createAdminClient } from "@/lib/supabase/admin"

type SocialConnectionUpdate =
  Database["public"]["Tables"]["social_connections"]["Update"]

type DbClient = ReturnType<typeof createAdminClient>

/** Refresh when expiry is within this window (ms). */
export const TIKTOK_REFRESH_LEAD_MS = 6 * 60 * 60 * 1000

export type TikTokOAuthTokenPayload = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  open_id?: string
  error?: string
  error_description?: string
  data?: {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    open_id?: string
  }
}

export function parseTikTokOAuthTokenPayload(raw: TikTokOAuthTokenPayload): {
  accessToken: string
  refreshToken: string | null
  expiresIn: number | null
  openId: string | null
} | null {
  const accessToken = raw.access_token ?? raw.data?.access_token
  if (!accessToken?.trim()) {
    return null
  }
  const refreshToken =
    raw.refresh_token?.trim() || raw.data?.refresh_token?.trim() || null
  const expiresIn =
    typeof raw.expires_in === "number"
      ? raw.expires_in
      : typeof raw.data?.expires_in === "number"
        ? raw.data.expires_in
        : null
  const openId = raw.open_id ?? raw.data?.open_id ?? null
  return {
    accessToken: accessToken.trim(),
    refreshToken,
    expiresIn,
    openId: openId?.trim() || null,
  }
}

export function tiktokOAuthTokenErrorMessage(raw: TikTokOAuthTokenPayload): string {
  return (
    raw.error_description ||
    raw.error ||
    "TikTok token response missing access_token"
  )
}

export function tokenExpiresAtFromExpiresIn(expiresIn: number): string {
  const ms = Math.max(60, expiresIn) * 1000
  return new Date(Date.now() + ms).toISOString()
}

export function tiktokAccessTokenNeedsRefresh(
  tokenExpiresAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!tokenExpiresAt) return true
  const expires = Date.parse(tokenExpiresAt)
  if (!Number.isFinite(expires)) return true
  return expires - nowMs <= TIKTOK_REFRESH_LEAD_MS
}

export async function exchangeTikTokRefreshToken(refreshToken: string): Promise<
  | {
      ok: true
      accessToken: string
      refreshToken: string | null
      expiresIn: number | null
    }
  | { ok: false; error: string }
> {
  let clientKey: string
  let clientSecret: string
  try {
    clientKey = tiktokClientKey()
    clientSecret = tiktokClientSecret()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "TikTok OAuth env missing.",
    }
  }

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const tokenData = (await tokenRes.json()) as TikTokOAuthTokenPayload
    const parsed = parseTikTokOAuthTokenPayload(tokenData)
    if (!parsed) {
      return {
        ok: false,
        error:
          tiktokOAuthTokenErrorMessage(tokenData) ||
          `TikTok refresh failed (${tokenRes.status}). Reconnect under Settings → Social.`,
      }
    }
    return {
      ok: true,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn,
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `TikTok refresh request failed: ${error.message}`
          : "TikTok refresh request failed.",
    }
  }
}

export type TikTokConnectionRow = {
  id: string
  entity_id: string
  account_id: string
  account_name: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
}

export async function persistRefreshedTikTokTokens(
  supabase: DbClient,
  connectionId: string,
  input: {
    accessToken: string
    refreshToken: string | null
    expiresIn: number | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: SocialConnectionUpdate = {
    access_token: input.accessToken,
    updated_at: new Date().toISOString(),
  }
  if (input.refreshToken) {
    patch.refresh_token = input.refreshToken
  }
  if (input.expiresIn != null && Number.isFinite(input.expiresIn)) {
    patch.token_expires_at = tokenExpiresAtFromExpiresIn(input.expiresIn)
  }

  const { error } = await supabase
    .from("social_connections")
    .update(patch)
    .eq("id", connectionId)
    .eq("platform", "tiktok")

  if (error) {
    return { ok: false, error: error.message ?? "Could not save refreshed token." }
  }
  return { ok: true }
}

export async function refreshTikTokConnectionIfNeeded(
  supabase: DbClient,
  row: TikTokConnectionRow
): Promise<
  | { ok: true; refreshed: boolean; accessToken: string }
  | { ok: false; error: string }
> {
  if (!tiktokAccessTokenNeedsRefresh(row.token_expires_at)) {
    return { ok: true, refreshed: false, accessToken: row.access_token.trim() }
  }

  const refreshToken = row.refresh_token?.trim()
  if (!refreshToken) {
    return {
      ok: false,
      error:
        "TikTok access token expired and no refresh token is stored — reconnect TikTok under Settings → Social.",
    }
  }

  const exchanged = await exchangeTikTokRefreshToken(refreshToken)
  if (!exchanged.ok) {
    return { ok: false, error: exchanged.error }
  }

  const saved = await persistRefreshedTikTokTokens(supabase, row.id, {
    accessToken: exchanged.accessToken,
    refreshToken: exchanged.refreshToken ?? refreshToken,
    expiresIn: exchanged.expiresIn,
  })
  if (!saved.ok) {
    return { ok: false, error: saved.error }
  }

  return {
    ok: true,
    refreshed: true,
    accessToken: exchanged.accessToken,
  }
}

export async function refreshAllExpiringTikTokConnections(input?: {
  supabase?: DbClient
}): Promise<{
  scanned: number
  refreshed: number
  skipped: number
  failed: number
  errors: string[]
}> {
  const supabase = input?.supabase ?? createAdminClient()
  const { data: rows, error } = await supabase
    .from("social_connections")
    .select(
      "id, entity_id, account_id, account_name, access_token, refresh_token, token_expires_at"
    )
    .eq("platform", "tiktok")
    .eq("is_active", true)
    .not("refresh_token", "is", null)

  if (error) {
    return {
      scanned: 0,
      refreshed: 0,
      skipped: 0,
      failed: 1,
      errors: [error.message ?? "Failed to load TikTok connections."],
    }
  }

  let refreshed = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const row of rows ?? []) {
    const connection: TikTokConnectionRow = {
      id: row.id,
      entity_id: row.entity_id,
      account_id: row.account_id,
      account_name: row.account_name,
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      token_expires_at: row.token_expires_at,
    }

    if (!tiktokAccessTokenNeedsRefresh(connection.token_expires_at)) {
      skipped += 1
      continue
    }

    const result = await refreshTikTokConnectionIfNeeded(supabase, connection)
    if (!result.ok) {
      failed += 1
      errors.push(`${connection.account_name || connection.account_id}: ${result.error}`)
      continue
    }
    if (result.refreshed) refreshed += 1
    else skipped += 1
  }

  return {
    scanned: rows?.length ?? 0,
    refreshed,
    skipped,
    failed,
    errors,
  }
}
