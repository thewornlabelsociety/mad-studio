import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

const PROTECTED_PREFIXES = [
  "/today",
  "/studio",
  "/invite",
  "/entities",
  "/campaigns",
  "/brain",
  "/analytics",
  "/inventory",
  "/settings",
] as const

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

function copySessionCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = from.headers.get(header)
    if (value) {
      to.headers.set(header, value)
    }
  }
  return to
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value)
          })
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("redirect", `${pathname}${search}`)
    return copySessionCookies(
      supabaseResponse,
      NextResponse.redirect(loginUrl)
    )
  }

  if (isAuthenticated && pathname === "/login") {
    const redirectParam = request.nextUrl.searchParams.get("redirect")
    const destination =
      redirectParam && isSafeRedirect(redirectParam) ? redirectParam : "/studio"
    return copySessionCookies(
      supabaseResponse,
      NextResponse.redirect(new URL(destination, request.url))
    )
  }

  return supabaseResponse
}
