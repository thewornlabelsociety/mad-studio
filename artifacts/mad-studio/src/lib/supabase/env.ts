import { assertMadStudioSupabaseProject } from "@/lib/supabase/project-guard"

export function getSupabaseUrl(): string {
  const value = import.meta.env.VITE_SUPABASE_URL
  if (!value) {
    throw new Error("Missing environment variable: VITE_SUPABASE_URL. Configure your Supabase public URL.")
  }
  assertMadStudioSupabaseProject(value, "VITE_SUPABASE_URL")
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
