/** Hostnames TikTok may pull from via /api/media/proxy (origin storage, not madstudio.nz). */
export function isAllowedProxyMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (host.endsWith(".supabase.co")) return true
  if (host.endsWith(".r2.dev")) return true

  const extras =
    process.env.MEDIA_PROXY_ALLOWED_HOSTS?.split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean) ?? []

  return extras.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  )
}

export function assertAllowedProxyMediaUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Media URL is invalid.")
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Media URL must be a public HTTP(S) URL.")
  }
  if (!isAllowedProxyMediaHost(url.hostname)) {
    throw new Error("Media URL host is not allowed for proxying.")
  }
  return url
}
