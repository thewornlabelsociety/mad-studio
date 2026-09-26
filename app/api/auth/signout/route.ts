import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

function siteOrigin(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin ??
    "http://localhost:3000"
  )
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", siteOrigin(request)), {
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
