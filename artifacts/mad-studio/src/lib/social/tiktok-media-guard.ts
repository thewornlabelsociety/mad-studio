export const TIKTOK_REQUIRES_VIDEO_MESSAGE =
  "TikTok needs a video (.mp4 or .mov) or a carousel of 2+ photos. A single static image can't be posted via TikTok Direct Post."

export const TIKTOK_CAROUSEL_VIDEO_MESSAGE =
  "TikTok photo carousels take photos only — remove the video slide or post the video on its own."

/** TikTok photo mode takes up to 35 images per post. */
export const TIKTOK_PHOTO_MAX = 35

export const TIKTOK_SANDBOX_DISPATCH_NOTE =
  "Dispatched to TikTok. In Sandbox mode, check your TikTok app Inbox -> System notifications or Private Videos tab to view."

const STATIC_IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i
const TIKTOK_VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|#|$)/i

function mediaPath(mediaUrl: string): string {
  try {
    return new URL(mediaUrl).pathname
  } catch {
    return mediaUrl.split(/[?#]/)[0] ?? mediaUrl
  }
}

export function isTikTokVideoUrl(mediaUrl: string): boolean {
  return TIKTOK_VIDEO_EXT.test(mediaPath(mediaUrl))
}

/**
 * Returns a user-facing error when the media is not suitable for TikTok Direct
 * Post: a single video, or (with `carouselUrls`) 2+ photos as a photo carousel.
 */
export function tikTokMediaGuardError(
  mediaUrl: string,
  carouselUrls?: string[] | null
): string | null {
  if (carouselUrls && carouselUrls.length >= 2) {
    if (carouselUrls.some(isTikTokVideoUrl)) return TIKTOK_CAROUSEL_VIDEO_MESSAGE
    if (carouselUrls.length > TIKTOK_PHOTO_MAX) {
      return `TikTok carousels take at most ${TIKTOK_PHOTO_MAX} photos.`
    }
    return null
  }

  const path = mediaPath(mediaUrl)
  if (STATIC_IMAGE_EXT.test(path)) {
    return TIKTOK_REQUIRES_VIDEO_MESSAGE
  }
  if (!TIKTOK_VIDEO_EXT.test(path)) {
    return TIKTOK_REQUIRES_VIDEO_MESSAGE
  }
  return null
}
