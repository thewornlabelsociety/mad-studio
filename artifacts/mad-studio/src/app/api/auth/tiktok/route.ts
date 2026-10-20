import { randomBytes } from "crypto"
import { NextResponse, type NextRequest } from "next/server"

import {
  TIKTOK_STATE_COOKIE,
  tiktokClientKey,
  tiktokRedirectUri,
  tiktokScopes,
} from "@/lib/social/tiktok-oauth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function settingsRedirect(request: NextRequest, status: string, reason?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  const url = new URL("/settings/social", baseUrl)
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason)
  return NextResponse.redirect(url)
}

/** Starts TikTok Login Kit: /api/auth/tiktok?entityId=<uuid> */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL("/login", request.nextUrl.origin)
    login.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return NextResponse.redirect(login)
  }

  const params = request.nextUrl.searchParams
  const entityId = params.get("entityId")?.trim() || null
  // Require explicit entity — never fall back to FÜDI/Worn name matching.
  if (!entityId) return settingsRedirect(request, "tiktok_error", "brand")

  const { data: canManage } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager"],
  })
  if (!canManage) return settingsRedirect(request, "tiktok_error", "forbidden")

  let clientKey: string
  try {
    clientKey = tiktokClientKey()
  } catch (err) {
    console.error("[tiktok-oauth]", err instanceof Error ? err.message : err)
    return settingsRedirect(request, "tiktok_error", "missing_client_key")
  }

  const state = randomBytes(16).toString("hex")
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/")
  authorize.searchParams.set("client_key", clientKey)
  authorize.searchParams.set("scope", tiktokScopes())
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("redirect_uri", tiktokRedirectUri())
  authorize.searchParams.set("state", state)
  // Force TikTok account picker — without this, browser SSO reuses the last
  // logged-in brand account (often FÜDI) when reconnecting Worn Label.
  authorize.searchParams.set("disable_auto_auth", "1")

  const response = NextResponse.redirect(authorize)
  response.cookies.set(TIKTOK_STATE_COOKIE, JSON.stringify({ state, entityId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/tiktok",
    maxAge: 10 * 60,
  })
  return response
}
