import { request as httpRequest } from "node:http"
import { request as httpsRequest } from "node:https"
import type { IncomingMessage } from "node:http"

import { createPinnedLookup } from "@/lib/media/pinned-dns-lookup"
import { normalizePinnedAddress, resolvePublicAddress } from "@/lib/media/safe-image-fetch"
import {
  assertAllowedProxyMediaUrl,
  isAllowedProxyMediaHost,
  parseProxyTargetUrl,
} from "@/lib/media/proxy-allowed-hosts"

const MAX_REDIRECTS = 4
const PROXY_TIMEOUT_MS = 120_000

const ALLOWED_MEDIA_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/octet-stream",
])

type StreamResult = {
  statusCode: number
  headers: IncomingMessage["headers"]
  stream: IncomingMessage
}

function requestStream(
  target: URL,
  rangeHeader: string | undefined
): Promise<StreamResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const hostname = target.hostname.replace(/^\[|\]$/g, "").trim()
      if (!hostname || !isAllowedProxyMediaHost(hostname)) {
        reject(new Error("Media URL host is not allowed for proxying."))
        return
      }

      const resolved = await resolvePublicAddress(hostname)
      const addressRecord = Array.isArray(resolved) ? resolved[0] : resolved
      const { address: pinnedIp } = normalizePinnedAddress(addressRecord, hostname)

      const transport = target.protocol === "https:" ? httpsRequest : httpRequest
      const pinnedLookup = createPinnedLookup(pinnedIp)

      const headers: Record<string, string> = {
        Accept: "*/*",
        "Accept-Ranges": "bytes",
        "User-Agent": "MAD-STUDIO-Media-Proxy/1.0",
      }
      if (rangeHeader?.trim()) {
        headers.Range = rangeHeader.trim()
      }

      const outgoing = transport(
        {
          protocol: target.protocol,
          hostname: target.hostname.replace(/^\[|\]$/g, ""),
          port: target.port || undefined,
          method: "GET",
          path: `${target.pathname}${target.search}`,
          headers,
          lookup: pinnedLookup as never,
          servername: target.hostname.replace(/^\[|\]$/g, ""),
          agent: false,
        },
        (response) => {
          resolve({
            statusCode: response.statusCode ?? 502,
            headers: response.headers,
            stream: response,
          })
        }
      )
      outgoing.setTimeout(PROXY_TIMEOUT_MS, () => {
        outgoing.destroy(new Error("Upstream media timed out."))
      })
      outgoing.on("error", reject)
      outgoing.end()
    } catch (error) {
      reject(error)
    }
  })
}

function normalizeContentType(
  header: string | undefined,
  pathname: string
): string {
  const fromHeader = header?.split(";")[0]?.trim().toLowerCase()
  if (fromHeader && ALLOWED_MEDIA_TYPES.has(fromHeader)) return fromHeader
  if (/\.mp4$/i.test(pathname)) return "video/mp4"
  if (/\.mov$/i.test(pathname)) return "video/quicktime"
  if (/\.webm$/i.test(pathname)) return "video/webm"
  if (/\.jpe?g$/i.test(pathname)) return "image/jpeg"
  if (/\.png$/i.test(pathname)) return "image/png"
  if (/\.webp$/i.test(pathname)) return "image/webp"
  return fromHeader || "application/octet-stream"
}

function assertStreamableType(contentType: string) {
  if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
    throw new Error(`Upstream media type "${contentType}" is not allowed.`)
  }
}

export async function openProxiedMediaStream(input: {
  sourceUrl: string
  rangeHeader?: string | undefined
}): Promise<StreamResult & { contentType: string }> {
  let target = parseProxyTargetUrl(input.sourceUrl)

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const upstream = await requestStream(target, input.rangeHeader)
    const status = upstream.statusCode

    if ([301, 302, 303, 307, 308].includes(status)) {
      upstream.stream.resume()
      const rawLocation = upstream.headers.location
      const location = Array.isArray(rawLocation)
        ? rawLocation[0]
        : typeof rawLocation === "string"
          ? rawLocation
          : undefined
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("Media source has too many redirects.")
      }
      target = assertAllowedProxyMediaUrl(new URL(location, target).toString())
      continue
    }

    if (status !== 200 && status !== 206) {
      upstream.stream.resume()
      throw new Error(`Upstream media returned HTTP ${status}.`)
    }

    const contentType = normalizeContentType(
      String(upstream.headers["content-type"] ?? ""),
      target.pathname
    )
    assertStreamableType(contentType)
    return { ...upstream, contentType }
  }

  throw new Error("Media source has too many redirects.")
}
