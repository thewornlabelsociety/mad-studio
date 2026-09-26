import { createServerClient } from "@supabase/ssr"
import { HttpResponse, type WebRequest } from "@server/http-response"

import type { Database } from "@/lib/database.types"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env"

function isSafeRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//")
}

export async function GET(request: WebRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const nextParam = requestUrl.searchParams.get("next")
  const token = requestUrl.searchParams.get("token")

  let next = "/studio"
  if (nextParam && isSafeRedirect(nextParam)) {
    next = nextParam
  } else if (token && /^[a-zA-Z0-9_-]+$/.test(token)) {
    next = `/invite/${token}`
  }

  const failureUrl = new URL("/login", requestUrl.origin)
  failureUrl.searchParams.set("error", "auth-failed")
  failureUrl.searchParams.set("redirect", next)

  if (!code) {
    return HttpResponse.redirect(failureUrl)
  }

  const successUrl = new URL(next, requestUrl.origin)
  const response = HttpResponse.redirect(successUrl)

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
  return HttpResponse.redirect(failureUrl)
}
