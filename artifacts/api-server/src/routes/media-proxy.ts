import { Router, type Request, type Response } from "express"
import { pipeline } from "node:stream/promises"

import { openProxiedMediaStream } from "../ported/lib/media/stream-public-media"

const router = Router()

/**
 * Public media proxy for TikTok PULL_FROM_URL (verified madstudio.nz domain).
 * GET /api/media/proxy?url=<encoded https://…supabase.co/…>
 */
router.get("/api/media/proxy", async (req: Request, res: Response): Promise<void> => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : ""
  if (!rawUrl) {
    res.status(400).json({ error: "url query parameter is required." })
    return
  }

  try {
    const upstream = await openProxiedMediaStream({
      sourceUrl: rawUrl,
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
      res.status(message.includes("not allowed") ? 403 : 502).json({ error: message })
    }
  }
})

export default router
