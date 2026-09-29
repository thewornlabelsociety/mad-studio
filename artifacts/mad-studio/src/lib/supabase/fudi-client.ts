import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * READ-ONLY client for the external FÜDI app Supabase project.
 * Used only to SELECT feed rows during `/api/intake/fudi-feed` sync.
 * Never use for Brain Memory, campaigns, or marketing_entities — those use MAD Studio Supabase.
 */
export function getFudiSupabaseClient() {
  const url = process.env.FUDI_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "Missing FUDI_SUPABASE_URL. Add the external FÜDI Supabase project URL to server environment (Replit Secrets or .env.local)."
    )
  }

  const anon = process.env.FUDI_SUPABASE_ANON_KEY?.trim()
  const serviceRole = process.env.FUDI_SUPABASE_SERVICE_ROLE_KEY?.trim()
  const preferService =
    process.env.FUDI_SUPABASE_USE_SERVICE_ROLE_FOR_READ === "1" ||
    process.env.FUDI_SUPABASE_USE_SERVICE_ROLE_FOR_READ === "true"

  const key = preferService
    ? serviceRole || anon
    : anon || serviceRole

  if (!key) {
    throw new Error(
      "Missing FUDI_SUPABASE_ANON_KEY (preferred) or FUDI_SUPABASE_SERVICE_ROLE_KEY for read-only FÜDI feed intake."
    )
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function getFudiSupabaseProjectUrl(): string {
  const url = process.env.FUDI_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error("Missing FUDI_SUPABASE_URL.")
  }
  return url.replace(/\/$/, "")
}
