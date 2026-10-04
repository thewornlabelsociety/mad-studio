/** Public HTTPS URLs that social APIs treat as video assets. */
export function isPublishVideoUrl(mediaUrl: string): boolean {
  const path = (() => {
    try {
      return new URL(mediaUrl).pathname
    } catch {
      return mediaUrl.split(/[?#]/)[0] ?? mediaUrl
    }
  })()
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(path)
}
