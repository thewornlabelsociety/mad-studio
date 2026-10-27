import {
  metaGraphBase,
  type PublishPlacement,
  type SocialConnectionRow,
} from "@/lib/social/types"
import { isPublishVideoUrl } from "@/lib/social/video-media"

/** Explicit media kind from callers, or inferred from URL extension. */
export type InstagramPublishMediaKind = "image" | "video"

/**
 * Resolve whether Instagram Content Publishing should use image_url or video_url.
 * Prefer an explicit kind/MIME/"VIDEO" from callers; otherwise sniff the URL path.
 */
export function resolveInstagramPublishMediaKind(
  mediaUrl: string,
  mediaKind?: string | null
): InstagramPublishMediaKind {
  const raw = (mediaKind ?? "").trim().toLowerCase()
  if (
    raw === "video" ||
    raw === "videos" ||
    raw === "reel" ||
    raw === "reels" ||
    raw.startsWith("video/")
  ) {
    return "video"
  }
  if (
    raw === "image" ||
    raw === "photo" ||
    raw === "photos" ||
    raw.startsWith("image/")
  ) {
    return "image"
  }
  return isPublishVideoUrl(mediaUrl) ? "video" : "image"
}

/**
 * Instagram Graph /{ig-user-id}/media container fields for a single asset.
 * Feed video → video_url + REELS; Story video → video_url + STORIES; images keep image_url.
 */
export function buildInstagramMediaContainerBody(input: {
  mediaUrl: string
  caption: string
  placement: PublishPlacement
  /** Override URL sniffing when callers already know the asset type. */
  mediaKind?: string | null
}): Record<string, string | undefined> {
  const isStory = input.placement === "story"
  const kind = resolveInstagramPublishMediaKind(input.mediaUrl, input.mediaKind)
  const caption = isStory ? undefined : input.caption

  if (kind === "video") {
    return {
      video_url: input.mediaUrl,
      caption,
      // Feed video publishes as a Reel; Stories keep media_type=STORIES with video_url.
      media_type: isStory ? "STORIES" : "REELS",
    }
  }

  return {
    image_url: input.mediaUrl,
    caption,
    media_type: isStory ? "STORIES" : undefined,
  }
}

type GraphErrorBody = {
  error?: {
    message?: string
    error_user_msg?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

async function graphRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST"
    accessToken: string
    body?: Record<string, string | undefined>
  }
): Promise<T> {
  const url = new URL(`${metaGraphBase()}${path}`)
  const method = init.method ?? "POST"

  let response: Response
  if (method === "GET") {
    url.searchParams.set("access_token", init.accessToken)
    if (init.body) {
      for (const [key, value] of Object.entries(init.body)) {
        if (value != null) url.searchParams.set(key, value)
      }
    }
    response = await fetch(url, { method: "GET", cache: "no-store" })
  } else {
    const form = new URLSearchParams()
    form.set("access_token", init.accessToken)
    if (init.body) {
      for (const [key, value] of Object.entries(init.body)) {
        if (value != null) form.set(key, value)
      }
    }
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
    })
  }

  const payload = (await response.json().catch(() => ({}))) as T & GraphErrorBody
  if (!response.ok || payload.error) {
    throw new Error(formatGraphError(payload.error, response.status, path))
  }
  return payload
}

function formatGraphError(
  error: GraphErrorBody["error"] | undefined,
  status: number,
  path: string
): string {
  if (!error) {
    return `Meta Graph request failed (${status}) on ${path}`
  }

  const code = error.code
  if (code === 190) {
    return (
      error.error_user_msg ||
      error.message ||
      "Meta access token is invalid or expired. Update the token in Social Connections."
    )
  }

  const parts = [
    error.error_user_msg || error.message,
    code != null ? `(code ${code}` : null,
    error.error_subcode != null ? `/${error.error_subcode}` : null,
    code != null ? ")" : null,
    error.fbtrace_id ? `fbtrace=${error.fbtrace_id}` : null,
  ].filter(Boolean)

  return parts.join(" ") || `Meta Graph request failed (${status}) on ${path}`
}

export type MetaPublishResult = {
  platform: "instagram" | "facebook"
  placement: PublishPlacement
  mediaId: string
  containerId?: string
  /** Story sequence — one media id per frame, in tray order. */
  mediaIds?: string[]
}

async function waitForInstagramContainer(input: {
  containerId: string
  accessToken: string
}): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const status = await graphRequest<{
      status_code?: string
      status?: string
    }>(`/${encodeURIComponent(input.containerId)}`, {
      method: "GET",
      accessToken: input.accessToken,
      body: { fields: "status_code,status" },
    })

    const code = (status.status_code || status.status || "").toUpperCase()
    if (code === "FINISHED" || code === "PUBLISHED") return
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(
        `Instagram media container failed (${code || "ERROR"}). Check image_url/video_url is publicly reachable over HTTPS.`
      )
    }

    await wait(attempt < 3 ? 1200 : 2000)
  }

  throw new Error(
    "Instagram media container did not finish processing in time. Retry in a moment."
  )
}

/** Instagram Content Publishing: create container → wait → publish. */
export async function publishInstagramMedia(input: {
  connection: SocialConnectionRow
  mediaUrl: string
  caption: string
  placement: PublishPlacement
  /** Optional: "video" | "image" | MIME / VIDEO — otherwise inferred from URL. */
  mediaKind?: string | null
}): Promise<MetaPublishResult> {
  const igUserId = input.connection.account_id

  const container = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media`,
    {
      method: "POST",
      accessToken: input.connection.access_token,
      body: buildInstagramMediaContainerBody({
        mediaUrl: input.mediaUrl,
        caption: input.caption,
        placement: input.placement,
        mediaKind: input.mediaKind,
      }),
    }
  )

  if (!container.id) {
    throw new Error("Instagram media container was not created.")
  }

  await waitForInstagramContainer({
    containerId: container.id,
    accessToken: input.connection.access_token,
  })

  const published = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media_publish`,
    {
      method: "POST",
      accessToken: input.connection.access_token,
      body: { creation_id: container.id },
    }
  )

  if (!published.id) {
    throw new Error("Instagram media_publish did not return a media id.")
  }

  return {
    platform: "instagram",
    placement: input.placement,
    mediaId: published.id,
    containerId: container.id,
  }
}

/** Facebook Page photo post. */
export async function publishFacebookPhoto(input: {
  connection: SocialConnectionRow
  mediaUrl: string
  caption: string
}): Promise<MetaPublishResult> {
  const pageId = input.connection.account_id
  const published = await graphRequest<{ id: string; post_id?: string }>(
    `/${encodeURIComponent(pageId)}/photos`,
    {
      method: "POST",
      accessToken: input.connection.access_token,
      body: {
        url: input.mediaUrl,
        message: input.caption,
      },
    }
  )

  const mediaId = published.post_id || published.id
  if (!mediaId) {
    throw new Error("Facebook photos publish did not return an id.")
  }

  return {
    platform: "facebook",
    placement: "feed",
    mediaId,
  }
}

export async function fetchMediaInsights(input: {
  mediaId: string
  accessToken: string
  metrics?: string[]
}): Promise<Record<string, number>> {
  const metricList = (
    input.metrics ?? ["impressions", "reach", "saved"]
  ).join(",")

  const payload = await graphRequest<{
    data?: Array<{ name?: string; values?: Array<{ value?: number }> }>
  }>(`/${encodeURIComponent(input.mediaId)}/insights`, {
    method: "GET",
    accessToken: input.accessToken,
    body: { metric: metricList },
  })

  const totals: Record<string, number> = {}
  for (const row of payload.data ?? []) {
    if (!row.name) continue
    const value = row.values?.[0]?.value
    totals[row.name] = typeof value === "number" ? value : 0
  }
  return totals
}

export type MetaVerifyResult = {
  ok: true
  platform: "instagram" | "facebook"
  accountId: string
  accountName: string
  message: string
}

/** Light Graph ping to validate a stored or draft token. */
export async function verifyMetaConnection(input: {
  platform: "instagram" | "facebook"
  accountId: string
  accessToken: string
}): Promise<MetaVerifyResult> {
  const accountId = input.accountId.trim()
  const accessToken = input.accessToken.trim()
  if (!accountId || !accessToken) {
    throw new Error("Account ID and access token are required.")
  }

  if (input.platform === "instagram") {
    const profile = await graphRequest<{
      id?: string
      username?: string
      name?: string
    }>(`/${encodeURIComponent(accountId)}`, {
      method: "GET",
      accessToken,
      body: { fields: "id,username,name" },
    })
    const accountName =
      profile.username?.trim() ||
      profile.name?.trim() ||
      accountId
    return {
      ok: true,
      platform: "instagram",
      accountId: profile.id || accountId,
      accountName,
      message: "Verified & Ready to Dispatch",
    }
  }

  const page = await graphRequest<{ id?: string; name?: string }>(
    `/${encodeURIComponent(accountId)}`,
    {
      method: "GET",
      accessToken,
      body: { fields: "id,name" },
    }
  )
  return {
    ok: true,
    platform: "facebook",
    accountId: page.id || accountId,
    accountName: page.name?.trim() || accountId,
    message: "Verified & Ready to Dispatch",
  }
}

/** Instagram feed carousel (2–10 images): child containers → CAROUSEL → publish. */
export async function publishInstagramCarousel(input: {
  connection: SocialConnectionRow
  mediaUrls: string[]
  caption: string
}): Promise<MetaPublishResult> {
  const igUserId = input.connection.account_id
  const accessToken = input.connection.access_token

  const childIds: string[] = []
  for (const imageUrl of input.mediaUrls) {
    const child = await graphRequest<{ id: string }>(
      `/${encodeURIComponent(igUserId)}/media`,
      {
        method: "POST",
        accessToken,
        body: { image_url: imageUrl, is_carousel_item: "true" },
      }
    )
    if (!child.id) {
      throw new Error("Instagram carousel slide container was not created.")
    }
    await waitForInstagramContainer({ containerId: child.id, accessToken })
    childIds.push(child.id)
  }

  const container = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media`,
    {
      method: "POST",
      accessToken,
      body: {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: input.caption,
      },
    }
  )
  if (!container.id) {
    throw new Error("Instagram carousel container was not created.")
  }
  await waitForInstagramContainer({ containerId: container.id, accessToken })

  const published = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media_publish`,
    {
      method: "POST",
      accessToken,
      body: { creation_id: container.id },
    }
  )
  if (!published.id) {
    throw new Error("Instagram media_publish did not return a media id.")
  }

  return {
    platform: "instagram",
    placement: "feed",
    mediaId: published.id,
    containerId: container.id,
  }
}

/** Facebook Page multi-photo post: upload photos unpublished, attach to one post. */
export async function publishFacebookAlbumPost(input: {
  connection: SocialConnectionRow
  mediaUrls: string[]
  caption: string
}): Promise<MetaPublishResult> {
  const pageId = input.connection.account_id
  const accessToken = input.connection.access_token

  const photoIds: string[] = []
  for (const url of input.mediaUrls) {
    const photo = await graphRequest<{ id: string }>(
      `/${encodeURIComponent(pageId)}/photos`,
      {
        method: "POST",
        accessToken,
        body: { url, published: "false" },
      }
    )
    if (!photo.id) throw new Error("Facebook photo upload did not return an id.")
    photoIds.push(photo.id)
  }

  const body: Record<string, string> = { message: input.caption }
  photoIds.forEach((id, index) => {
    body[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id })
  })
  const post = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(pageId)}/feed`,
    { method: "POST", accessToken, body }
  )
  if (!post.id) throw new Error("Facebook post did not return an id.")

  return { platform: "facebook", placement: "feed", mediaId: post.id }
}

/** Multi-select Story: one Graph publish per frame (viewers tap through in order). */
export async function publishInstagramStorySequence(input: {
  connection: SocialConnectionRow
  mediaUrls: string[]
}): Promise<MetaPublishResult> {
  const urls = input.mediaUrls.slice(0, 10).filter(Boolean)
  if (urls.length < 2) {
    throw new Error("Story sequence needs at least two images.")
  }

  const mediaIds: string[] = []
  for (const [index, mediaUrl] of urls.entries()) {
    const result = await publishInstagramMedia({
      connection: input.connection,
      mediaUrl,
      caption: "",
      placement: "story",
    })
    mediaIds.push(result.mediaId)
    if (index < urls.length - 1) {
      await wait(800)
    }
  }

  const last = mediaIds[mediaIds.length - 1]!
  return {
    platform: "instagram",
    placement: "story",
    mediaId: last,
    mediaIds,
  }
}

export async function publishToMeta(input: {
  connection: SocialConnectionRow
  mediaUrl: string
  caption: string
  placement: PublishPlacement
  /** Optional override for single-asset IG publish (URL sniff is the default). */
  mediaKind?: string | null
  /** 2–10 images to post as one feed carousel / multi-photo post. */
  carouselUrls?: string[] | null
  /** 2–10 images → consecutive Instagram Story frames (tray order). */
  storyUrls?: string[] | null
}): Promise<MetaPublishResult> {
  const carousel =
    input.placement === "feed" &&
    input.carouselUrls &&
    input.carouselUrls.length >= 2
      ? input.carouselUrls.slice(0, 10)
      : null
  const storySequence =
    input.placement === "story" &&
    input.storyUrls &&
    input.storyUrls.length >= 2
      ? input.storyUrls.slice(0, 10)
      : null

  if (input.connection.platform === "instagram") {
    if (storySequence) {
      return publishInstagramStorySequence({
        connection: input.connection,
        mediaUrls: storySequence,
      })
    }
    if (carousel) {
      return publishInstagramCarousel({ ...input, mediaUrls: carousel })
    }
    return publishInstagramMedia(input)
  }
  if (input.connection.platform === "facebook") {
    if (input.placement === "story") {
      throw new Error(
        "Facebook Page Stories are not supported by this publisher yet — use Instagram Stories or a Facebook feed photo."
      )
    }
    if (carousel) {
      return publishFacebookAlbumPost({ ...input, mediaUrls: carousel })
    }
    return publishFacebookPhoto(input)
  }
  throw new Error(
    `Platform "${input.connection.platform}" is not supported by the Meta Graph publisher.`
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
