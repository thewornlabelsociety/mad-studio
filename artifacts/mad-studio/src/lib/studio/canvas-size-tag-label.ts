/** Drop leading AU from synced listing sizes (AU 8 → 8). */
export function stripAuSizePrefix(raw: string): string {
  return raw.trim().replace(/^AU[\s\-]*/i, "").trim()
}

/**
 * Just the size people shop by: the first size of a multi-system listing,
 * without AU or a "Size" prefix. "AU 8 | EU 36 | US 4" → "8", "Size M" → "M".
 */
export function shortSizeValue(raw: string): string {
  let value = raw.trim()
  if (!value) return ""
  // First size only: "AU 8 | EU 36 | US 4", "AU 7.5 · EU 41 · US 8.5".
  value = value.split(/\s*[|·•,;]\s*/)[0] ?? value
  value = value.replace(/^(size|sz)\s*[:.]?\s*/i, "").trim()
  value = stripAuSizePrefix(value)
  // "8 (EU 36)" or "8 EU 36" → "8"
  value = value.replace(/\s*\(.*\)\s*$/, "").replace(/\s+(EU|US|UK|IT|FR)\b.*$/i, "").trim()
  return value
}

/**
 * On-image size tags: always "SIZE" + one value, never "AU" or "Sz".
 * AU 8 → SIZE 8 · AU 8 | EU 36 | US 4 → SIZE 8 · Size M → SIZE M · One Size → ONE SIZE
 */
export function formatCanvasSizeTagLabel(raw: string): string {
  const value = shortSizeValue(raw)
  if (!value) return ""
  if (/^one\s*size$|^os$/i.test(value)) return "ONE SIZE"
  return `SIZE ${value.toUpperCase()}`
}

/** The same size in sentence case for captions and lists: "Size 8", "One size". */
export function formatSizeForText(raw: string | null | undefined): string | null {
  const value = shortSizeValue(raw ?? "")
  if (!value) return null
  if (/^one\s*size$|^os$/i.test(value)) return "One size"
  return `Size ${value.toUpperCase()}`
}
