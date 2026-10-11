const API_DOWN_HINT =
  "The API server is not running. On Windows run scripts/dev-windows.ps1 (UI + API), or start the API on port 8080: pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start"

export async function parseApiJsonResponse<T = Record<string, unknown>>(
  response: Response
): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    if (
      response.status >= 500 ||
      response.status === 502 ||
      response.status === 503
    ) {
      throw new Error(API_DOWN_HINT)
    }
    throw new Error(`Empty server response (HTTP ${response.status}).`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    if (response.status === 404 && /Cannot GET|Not Found|<!DOCTYPE/i.test(text)) {
      throw new Error(
        `API route not found (HTTP 404). Rebuild and restart the API on port 8080 (close old dev PowerShell windows, then run scripts/dev-windows.ps1). ${API_DOWN_HINT}`
      )
    }
    throw new Error(
      `Server returned non-JSON (HTTP ${response.status}). ${API_DOWN_HINT}`
    )
  }
}
