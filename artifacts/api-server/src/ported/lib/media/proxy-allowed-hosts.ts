function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").trim().toLowerCase()
}

/** Basic hostname shape before allowlist matching. */
export function isValidProxyHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname)
  if (!host || host.length > 253) return false
  if (!/^[a-z0-9.-]+$/.test(host)) return false
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return false
  return true
}

/** Hostnames TikTok may pull from via /api/media/proxy (origin storage, not madstudio.nz). */
export function isAllowedProxyMediaHost(hostname: string): boolean {
  if (!isValidProxyHostname(hostname)) return false
  const host = normalizeHostname(hostname)
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
    url = new URL(raw.trim())
  } catch {
    throw new Error("Invalid target URL format")
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Media URL must be a public HTTP(S) URL.")
  }
  const host = normalizeHostname(url.hostname)
  if (!host) {
    throw new Error("Media URL is missing a hostname.")
  }
  if (!isAllowedProxyMediaHost(host)) {
    throw new Error("Media URL host is not allowed for proxying.")
  }
  return url
}

/** Decode nested `?url=` values (often double-encoded) and validate allowed upstream hosts. */
export function parseProxyTargetUrl(raw: string): URL {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Missing required 'url' query parameter")
  }

  let candidate = trimmed
  for (let pass = 0; pass < 2; pass += 1) {
    if (!candidate.includes("%")) break
    try {
      const decoded = decodeURIComponent(candidate)
      if (
        decoded !== candidate &&
        (decoded.startsWith("http://") || decoded.startsWith("https://"))
      ) {
        candidate = decoded
      } else {
        break
      }
    } catch {
      break
    }
  }

  try {
    return assertAllowedProxyMediaUrl(candidate)
  } catch (firstError) {
    try {
      return assertAllowedProxyMediaUrl(new URL(candidate).href)
    } catch {
      throw firstError instanceof Error ? firstError : new Error("Invalid target URL format")
    }
  }
}
