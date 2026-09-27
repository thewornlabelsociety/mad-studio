export const META_STATE_COOKIE = "meta_oauth_state"
export const META_GRAPH_VERSION = "v21.0"
const CANONICAL_HOST = "madstudio.nz"

export type MetaOAuthState = { state: string; entityId: string }

/** Public site origin for OAuth redirects — never Replit internal hosts. */
export function metaPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (raw) {
    return assertCanonicalSiteUrl(raw, "NEXT_PUBLIC_SITE_URL")
  }
  return "https://madstudio.nz"
}

/**
 * Must match the redirect URI in the Meta app settings exactly.
 * Always uses https://madstudio.nz (ignores replit.app host overrides).
 */
export function metaRedirectUri(): string {
  const raw = process.env.META_REDIRECT_URI?.trim()
  if (raw) {
    const url = new URL(raw)
    if (url.hostname !== CANONICAL_HOST || url.protocol !== "https:") {
      throw new Error(
        `META_REDIRECT_URI must be on https://${CANONICAL_HOST} (got ${url.origin})`
      )
    }
    return url.toString()
  }
  return `${metaPublicSiteUrl()}/api/auth/meta/callback`
}

export function metaAppId(): string {
  const id = process.env.META_APP_ID?.trim()
  if (!id) {
    throw new Error("Missing META_APP_ID in environment variables")
  }
  return id
}

export function metaAppSecret(): string {
  const secret = process.env.META_APP_SECRET?.trim()
  if (!secret) {
    throw new Error("Missing META_APP_SECRET in environment variables")
  }
  return secret
}

export function metaGraphBase(): string {
  return `https://graph.facebook.com/${META_GRAPH_VERSION}`
}

export function metaOAuthScopes(): string {
  return (
    process.env.META_OAUTH_SCOPES?.trim() ||
    [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ].join(",")
  )
}

export function parseStateCookie(raw: string | undefined): MetaOAuthState | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<MetaOAuthState>
    return typeof parsed.state === "string" && typeof parsed.entityId === "string"
      ? { state: parsed.state, entityId: parsed.entityId }
      : null
  } catch {
    return null
  }
}

function assertCanonicalSiteUrl(value: string, label: string): string {
  const url = new URL(value)
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use https`)
  }
  if (url.hostname !== CANONICAL_HOST) {
    throw new Error(`${label} must be https://${CANONICAL_HOST} (got ${url.hostname})`)
  }
  return url.origin
}
