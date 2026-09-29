/** Browser-safe Supabase public config (injected at build/dev via vite `define`). */
export function getSupabaseUrl(): string {
  const value = import.meta.env.VITE_SUPABASE_URL
  if (!value) {
    throw new Error(
      "Missing environment variable: VITE_SUPABASE_URL (set NEXT_PUBLIC_SUPABASE_URL in Replit Secrets, then restart the MAD Studio web service)."
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
