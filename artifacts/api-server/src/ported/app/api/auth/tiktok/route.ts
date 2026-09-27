import { randomBytes } from "crypto"

import { HttpResponse, type WebRequest } from "@server/http-response"

import {
  TIKTOK_STATE_COOKIE,
  tiktokClientKey,
  tiktokRedirectUri,
  tiktokScopes,
} from "@/lib/social/tiktok-oauth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function settingsRedirect(request: WebRequest, status: string, reason?: string) {
  const url = new URL("/settings/social", request.url)
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason)
  return HttpResponse.redirect(url)
}

/**
 * Starts TikTok Login Kit: /api/auth/tiktok?entityId=<uuid> (or ?brand=fudi|worn).
 * Sets a one-time state cookie the callback verifies.
 */
export async function GET(request: WebRequest) {
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
    return HttpResponse.redirect(login)
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

  const response = HttpResponse.redirect(authorize)
  // Express cookie options: maxAge is milliseconds.
  response.cookies.set(TIKTOK_STATE_COOKIE, JSON.stringify({ state, entityId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/tiktok",
    maxAge: 10 * 60 * 1000,
  })
  return response
}
