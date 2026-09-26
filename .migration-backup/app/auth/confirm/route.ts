import { createServerClient } from "@supabase/ssr"
import { type EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const nextParam = searchParams.get("next")
  const next =
    nextParam && isSafeRedirect(nextParam) ? nextParam : "/studio"

  const successUrl = new URL(next, origin)
  const failureUrl = new URL("/login", origin)
  failureUrl.searchParams.set("redirect", next)

  // PKCE flow (default for modern Supabase email confirmation links)
  if (code) {
    const response = NextResponse.redirect(successUrl)
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

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }

    failureUrl.searchParams.set("error", error.message)
    return NextResponse.redirect(failureUrl)
  }

  // Legacy token_hash flow (custom email templates)
  if (tokenHash && type) {
    const response = NextResponse.redirect(successUrl)
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

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      return response
    }

    failureUrl.searchParams.set("error", error.message)
    return NextResponse.redirect(failureUrl)
  }

  failureUrl.searchParams.set(
    "error",
    "Could not confirm email link. Open the link on the same device where the app is running."
  )
  return NextResponse.redirect(failureUrl)
}
