import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/middleware"

const CANONICAL_HOST = "madstudio.nz"
// Auth cookies are per-domain, so aliases must land on the canonical host.
const ALIAS_HOSTS = new Set([
  "www.madstudio.nz",
  "madstudio.co.nz",
  "www.madstudio.co.nz",
])

export async function proxy(request: NextRequest) {
  const host = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")

  if (ALIAS_HOSTS.has(host)) {
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`
    )
    return NextResponse.redirect(target, 308)
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
