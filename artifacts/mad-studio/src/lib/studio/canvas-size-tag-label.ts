/** Drop leading AU from synced listing sizes (AU 8 → 8). */
export function stripAuSizePrefix(raw: string): string {
  return raw.trim().replace(/^AU[\s\-]*/i, "").trim()
}

/**
 * On-image size tags: always "SIZE" + value, never "AU" or "Sz".
 * AU 8 → SIZE 8 · 8 → SIZE 8 · Size M → SIZE M
 */
export function formatCanvasSizeTagLabel(raw: string): string {
  let value = raw.trim()
  if (!value) return ""
  value = value.replace(/^(size|sz)\s+/i, "").trim()
  value = stripAuSizePrefix(value)
  if (!value) return ""
  return `SIZE ${value}`
}
