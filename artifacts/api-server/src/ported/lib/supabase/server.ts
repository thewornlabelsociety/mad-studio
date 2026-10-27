import { createServerClient } from "@supabase/ssr"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { cookies, headers } from "@server/request-context"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const authorization = headerStore.get("authorization")?.trim() ?? ""
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  // Vite action client sends Authorization. Prefer a JWT-scoped client so
  // RLS updates (e.g. canvas_layouts) work when cookies aren't on the API port.
  if (bearer) {
    return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, _headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}
