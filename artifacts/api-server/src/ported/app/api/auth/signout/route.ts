import { createServerClient } from "@supabase/ssr"
import { HttpResponse, type WebRequest } from "@server/http-response"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

export async function POST(request: WebRequest) {
  const response = HttpResponse.redirect(new URL("/login", request.nextUrl.origin), {
    status: 303,
  })

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.signOut()
  return response
}
