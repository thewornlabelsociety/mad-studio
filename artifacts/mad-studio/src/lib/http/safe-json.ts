/** Parse JSON bodies without throwing on HTML error pages or markdown fences. */
export async function readJsonBody<T = unknown>(
  response: Response
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const raw = await response.text()
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: false, error: `Empty response (${response.status}).` }
  }
  const unfenced = stripMarkdownCodeFence(trimmed)
  try {
    return { ok: true, data: JSON.parse(unfenced) as T }
  } catch {
    const snippet = unfenced.slice(0, 120).replace(/\s+/g, " ")
    return {
      ok: false,
      error: response.ok
        ? `Invalid JSON: ${snippet}`
        : `Request failed (${response.status}): ${snippet}`,
    }
  }
}

export function stripMarkdownCodeFence(text: string): string {
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i)
  if (fence?.[1]) return fence[1].trim()
  return text
}
