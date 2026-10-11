/** Browser-safe Supabase public config (injected at build/dev via vite `define`). */
export function getSupabaseUrl(): string {
  const value = import.meta.env.VITE_SUPABASE_URL
  if (!value) {
    throw new Error(
      "Supabase URL was not baked into this Vite build. Set NEXT_PUBLIC_SUPABASE_URL (and NEXT_PUBLIC_SUPABASE_ANON_KEY) in the repo root .env or Replit Secrets, then fully restart the MAD Studio dev server — a browser refresh alone is not enough."
    )
  }
  return value
}

export function getSupabaseAnonKey(): string {
  const value =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!value) {
    throw new Error(
      "Missing VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY. Configure your Supabase public key."
    )
  }
  return value
}
