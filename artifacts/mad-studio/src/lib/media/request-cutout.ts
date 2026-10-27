/** Background-removed PNG of a photo (server remove-bg). Returns its public URL. */
export async function requestCutout(input: {
  imageUrl: string
  entityId: string
}): Promise<string> {
  // Server accepts proxy paths; send tray URL as-is so cutoutSourceUrl matches.
  const response = await fetch("/api/media/remove-bg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: input.imageUrl.trim(),
      entityId: input.entityId,
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    transparentUrl?: string
    error?: string
  }
  if (!response.ok || !payload.transparentUrl) {
    throw new Error(payload.error ?? `Cutout failed (${response.status}).`)
  }
  return payload.transparentUrl
}
