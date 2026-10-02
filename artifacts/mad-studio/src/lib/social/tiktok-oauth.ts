export const TIKTOK_STATE_COOKIE = "tiktok_oauth_state"

export function tiktokClientKey(): string {
  const key = process.env.TIKTOK_CLIENT_KEY?.trim()
  if (!key) {
    throw new Error("Missing TIKTOK_CLIENT_KEY in environment variables")
  }
  return key
}

export function tiktokClientSecret(): string {
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim()
  if (!secret) {
    throw new Error("Missing TIKTOK_CLIENT_SECRET in environment variables")
  }
  return secret
}

/** Must match the redirect URI registered in the TikTok developer portal exactly. */
export function tiktokRedirectUri(): string {
  return (
    process.env.TIKTOK_REDIRECT_URI?.trim() ||
    "https://madstudio.nz/api/auth/tiktok/callback"
  )
}

export function tiktokScopes(): string {
  return (
    process.env.TIKTOK_SCOPES?.trim() ||
    "user.info.basic,video.upload,video.publish"
  )
}

export type TikTokOAuthState = { state: string; entityId: string }

export function parseStateCookie(raw: string | undefined): TikTokOAuthState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<TikTokOAuthState>
    return typeof parsed.state === "string" && typeof parsed.entityId === "string"
      ? { state: parsed.state, entityId: parsed.entityId }
      : null
  } catch {
    return null
  }
}
