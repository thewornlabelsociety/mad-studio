import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

function getBrowserCookieOptions() {
  const isSecureReplitPreview =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    window.location.hostname.endsWith(".replit.dev")

  if (!isSecureReplitPreview) return undefined

  return {
    sameSite: "none" as const,
    secure: true,
    partitioned: true,
  }
}

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    { cookieOptions: getBrowserCookieOptions() },
  )
}
