/**
 * Read a JSON response from the API server, with a readable error when the
 * server answers with a web page instead (e.g. a route an older running build
 * doesn't have yet) rather than "Unexpected token '<'".
 */
export async function readApiJson<T>(
  response: Response
): Promise<T & { error?: string }> {
  const type = response.headers.get("content-type") ?? ""
  if (!type.includes("application/json")) {
    throw new Error(
      response.status === 404
        ? "The API server doesn't have this feature yet — restart it from the latest code."
        : `The server returned an unexpected response (${response.status}).`
    )
  }
  return (await response.json()) as T & { error?: string }
}
