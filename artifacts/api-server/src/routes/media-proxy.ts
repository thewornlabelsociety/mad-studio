import { Router, type Request, type Response } from "express"
import { pipeline } from "node:stream/promises"

import {
  assertAllowedProxyMediaUrl,
  isAllowedProxyMediaHost,
  isValidProxyHostname,
} from "../ported/lib/media/proxy-allowed-hosts"
import { openProxiedMediaStream } from "../ported/lib/media/stream-public-media"

const router = Router()

/** Express splits on `&` in query values; read everything after the first `url=`. */
function extractRawTargetUrl(req: Request): string {
  const original = req.originalUrl ?? req.url ?? ""
  const urlIndex = original.indexOf("url=")
  if (urlIndex !== -1) {
    return original.slice(urlIndex + 4)
  }
  const rawParam = req.query.url
  if (typeof rawParam === "string") return rawParam.trim()
  if (Array.isArray(rawParam) && typeof rawParam[0] === "string") {
    return rawParam[0].trim()
  }
  return ""
}

function decodeTargetUrl(rawTargetUrl: string): string {
  let decodedUrl = rawTargetUrl
  try {
    decodedUrl = decodeURIComponent(rawTargetUrl)
    if (decodedUrl.includes("%3A") || decodedUrl.includes("%2F")) {
      decodedUrl = decodeURIComponent(decodedUrl)
    }
  } catch {
    // If decode fails, fallback to raw string
  }
  return decodedUrl
}

/**
 * Public media proxy for TikTok PULL_FROM_URL (verified madstudio.nz domain).
 * GET /api/media/proxy?url=<encoded https://…supabase.co/…>
 */
router.get("/api/media/proxy", async (req: Request, res: Response): Promise<void> => {
  const rawTargetUrl = extractRawTargetUrl(req)
  if (!rawTargetUrl) {
    res.status(400).json({ error: "Missing required 'url' parameter" })
    return
  }

  const decodedUrl = decodeTargetUrl(rawTargetUrl)

  let parsedUrl: URL
  try {
    parsedUrl = new URL(decodedUrl)
  } catch {
    res.status(400).json({ error: `Invalid URL format: ${decodedUrl}` })
    return
  }

  if (
    !isValidProxyHostname(parsedUrl.hostname) ||
    !isAllowedProxyMediaHost(parsedUrl.hostname)
  ) {
    res.status(403).json({ error: "Media URL host is not allowed for proxying." })
    return
  }

  let targetUrl: URL
  try {
    targetUrl = assertAllowedProxyMediaUrl(parsedUrl.href)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid target URL format"
    res.status(message.includes("not allowed") ? 403 : 400).json({ error: message })
    return
  }

  try {
    const upstream = await openProxiedMediaStream({
      sourceUrl: targetUrl.href,
      rangeHeader: req.header("range") ?? undefined,
    })

    res.status(upstream.statusCode)
    res.setHeader("Content-Type", upstream.contentType)
    res.setHeader("Accept-Ranges", "bytes")
    res.setHeader("Cache-Control", "public, max-age=3600")
    res.setHeader("X-Content-Type-Options", "nosniff")

    const contentLength = upstream.headers["content-length"]
    if (contentLength) {
      res.setHeader("Content-Length", String(contentLength))
    }
    const contentRange = upstream.headers["content-range"]
    if (contentRange) {
      res.setHeader("Content-Range", String(contentRange))
    }

    upstream.stream.on("error", () => {
      if (!res.headersSent) {
        res.status(502).json({ error: "Upstream media stream failed." })
        return
      }
      res.destroy()
    })

    await pipeline(upstream.stream, res)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Media proxy failed."
    if (!res.headersSent) {
      const status =
        message.includes("Missing") || message.includes("Invalid target")
          ? 400
          : message.includes("not allowed") || message.includes("hostname")
            ? 403
            : 502
      res.status(status).json({ error: message })
    }
  }
})

export default router
