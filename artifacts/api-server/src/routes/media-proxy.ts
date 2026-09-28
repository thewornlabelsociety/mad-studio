import { Router, type Request, type Response } from "express"
import { pipeline } from "node:stream/promises"

import { parseProxyTargetUrl } from "../ported/lib/media/proxy-allowed-hosts"
import { openProxiedMediaStream } from "../ported/lib/media/stream-public-media"

const router = Router()

/**
 * Public media proxy for TikTok PULL_FROM_URL (verified madstudio.nz domain).
 * GET /api/media/proxy?url=<encoded https://…supabase.co/…>
 */
router.get("/api/media/proxy", async (req: Request, res: Response): Promise<void> => {
  const rawParam = req.query.url
  const rawUrl =
    typeof rawParam === "string"
      ? rawParam.trim()
      : Array.isArray(rawParam) && typeof rawParam[0] === "string"
        ? rawParam[0].trim()
        : ""

  let targetUrl: URL
  try {
    targetUrl = parseProxyTargetUrl(rawUrl)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid target URL format"
    const status = message.includes("Missing") || message.includes("Invalid")
      ? 400
      : message.includes("not allowed")
        ? 403
        : 400
    res.status(status).json({ error: message })
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
