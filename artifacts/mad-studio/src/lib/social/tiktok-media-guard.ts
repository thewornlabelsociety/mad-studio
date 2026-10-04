export const TIKTOK_REQUIRES_VIDEO_MESSAGE =
  "TikTok requires a video file (.mp4 or .mov). Static images cannot be posted via TikTok Direct Post."

export const TIKTOK_SANDBOX_DISPATCH_NOTE =
  "Dispatched to TikTok. In Sandbox mode, check your TikTok app Inbox -> System notifications or Private Videos tab to view."

const STATIC_IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i
const TIKTOK_VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|#|$)/i

export function isTikTokVideoUrl(mediaUrl: string): boolean {
  const path = (() => {
    try {
      return new URL(mediaUrl).pathname
    } catch {
      return mediaUrl.split(/[?#]/)[0] ?? mediaUrl
    }
  })()
  return TIKTOK_VIDEO_EXT.test(path)
}

/** Returns a user-facing error when `mediaUrl` is not suitable for TikTok Direct Post. */
export function tikTokMediaGuardError(mediaUrl: string): string | null {
  const path = (() => {
    try {
      return new URL(mediaUrl).pathname
    } catch {
      return mediaUrl.split(/[?#]/)[0] ?? mediaUrl
    }
  })()

  if (STATIC_IMAGE_EXT.test(path)) {
    return TIKTOK_REQUIRES_VIDEO_MESSAGE
  }
  if (!TIKTOK_VIDEO_EXT.test(path)) {
    return TIKTOK_REQUIRES_VIDEO_MESSAGE
  }
  return null
}
