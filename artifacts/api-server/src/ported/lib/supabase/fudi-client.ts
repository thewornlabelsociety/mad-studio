import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/** Server-only client for the external FÜDI Supabase project (never use NEXT_PUBLIC_*). */
export function getFudiSupabaseClient() {
  const url = process.env.FUDI_SUPABASE_URL?.trim()
  if (!url) {
    throw new Error(
      "Missing FUDI_SUPABASE_URL. Add the external FÜDI Supabase project URL to server environment (Replit Secrets or .env.local)."
    )
  }

  const serviceRole = process.env.FUDI_SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.FUDI_SUPABASE_ANON_KEY?.trim()
  const key = serviceRole || anon
  if (!key) {
    throw new Error(
      "Missing FUDI_SUPABASE_SERVICE_ROLE_KEY or FUDI_SUPABASE_ANON_KEY for the external FÜDI Supabase project."
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
