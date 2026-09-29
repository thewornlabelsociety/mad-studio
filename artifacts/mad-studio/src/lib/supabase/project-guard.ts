function readFudiSupabaseUrlFromServerEnv(): string | undefined {
  if (typeof process === "undefined") return undefined
  return process.env.FUDI_SUPABASE_URL?.trim()
}

/** Prevent MAD Studio env from pointing at the external FÜDI Supabase project (server-side). */
export function assertMadStudioSupabaseProject(
  url: string,
  label = "Supabase URL"
): void {
  const fudi = readFudiSupabaseUrlFromServerEnv()
  if (!fudi) return

  const normalize = (value: string) => value.trim().replace(/\/$/, "").toLowerCase()
  if (normalize(url) === normalize(fudi)) {
    throw new Error(
      `${label} must be the MAD Studio project (VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL), not FUDI_SUPABASE_URL. The FÜDI project is read-only for feed intake; Brain Memory and inventory write to MAD Studio only.`
    )
  }
}
