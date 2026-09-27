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

function settingsRedirect(request: NextRequest, status: string) {
  return NextResponse.redirect(
    new URL(`/settings/social?status=${status}`, request.url)
  )
}

/**
 * Starts TikTok Login Kit: /api/auth/tiktok?entityId=<uuid> (or ?brand=fudi|worn).
 * Sets a one-time state cookie the callback verifies.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL("/login", request.url)
    login.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return NextResponse.redirect(login)
  }

  const params = request.nextUrl.searchParams
  let entityId = params.get("entityId")?.trim() || null
  if (!entityId) {
    const brand = params.get("brand")?.toLowerCase().includes("fudi")
      ? "%fudi%"
      : "%worn%"
    const { data: entity } = await supabase
      .from("entities")
      .select("id")
      .ilike("name", brand)
      .limit(1)
      .maybeSingle()
    entityId = entity?.id ?? null
  }
  if (!entityId) return settingsRedirect(request, "tiktok_error&reason=brand")

  const { data: canManage } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager"],
  })
  if (!canManage) return settingsRedirect(request, "tiktok_error&reason=forbidden")

  const state = randomBytes(16).toString("hex")
  const authorize = new URL("https://www.tiktok.com/v2/auth/authorize/")
  authorize.searchParams.set("client_key", tiktokClientKey())
  authorize.searchParams.set("scope", tiktokScopes())
  authorize.searchParams.set("response_type", "code")
  authorize.searchParams.set("redirect_uri", tiktokRedirectUri())
  authorize.searchParams.set("state", state)

  const response = NextResponse.redirect(authorize)
  response.cookies.set(TIKTOK_STATE_COOKIE, JSON.stringify({ state, entityId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/tiktok",
    maxAge: 600,
  })
  return response
}
