/** A phone photo shrunk to at most 1600px on its long side, as a JPEG for upload. */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext("2d")
  if (context) {
    // See-through PNGs get a white backing (JPEG would turn them black).
    context.fillStyle = "#FFFFFF"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  }
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't read the photo."))), "image/jpeg", 0.86)
  )
}

/** Upload a photo for a template; returns its stored URL. */
export async function uploadPhoto(blob: Blob, entityId: string): Promise<string> {
  const form = new FormData()
  form.append("file", blob, "photo.jpg")
  form.append("entityId", entityId)
  const response = await fetch("/api/media/upload-cutout", { method: "POST", body: form })
  const payload = (await response.json().catch(() => ({}))) as { transparentUrl?: string }
  if (!response.ok || !payload.transparentUrl) throw new Error("Couldn't upload the photo.")
  return payload.transparentUrl
}

/** Same-origin address for a stored photo, so it bakes into the slide. */
export function proxiedPhotoUrl(url: string, entityId: string): string {
  return `/api/media/image-proxy?url=${encodeURIComponent(url)}&entityId=${encodeURIComponent(entityId)}`
}
