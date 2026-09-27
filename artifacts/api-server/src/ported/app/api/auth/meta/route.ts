import { randomBytes } from "crypto"

import { HttpResponse, type WebRequest } from "@server/http-response"

import {
  META_GRAPH_VERSION,
  META_STATE_COOKIE,
  metaAppId,
  metaOAuthScopes,
  metaPublicSiteUrl,
  metaRedirectUri,
} from "@/lib/social/meta-oauth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function settingsRedirect(status: string, reason?: string) {
  const url = new URL("/settings/social", metaPublicSiteUrl())
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason)
  return HttpResponse.redirect(url)
}

/**
 * Starts Meta Login for Instagram + Facebook Page tokens:
 * /api/auth/meta?entityId=<uuid>
 */
export async function GET(request: WebRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const login = new URL("/login", metaPublicSiteUrl())
    login.searchParams.set(
      "redirect",
      `${request.nextUrl.pathname}${request.nextUrl.search}`
    )
    return HttpResponse.redirect(login)
  }

  const entityId = request.nextUrl.searchParams.get("entityId")?.trim() || null
  if (!entityId) return settingsRedirect("meta_error", "missing_entity")

  const { data: canManage } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: ["entity_manager"],
  })
  if (!canManage) return settingsRedirect("meta_error", "forbidden")

  let appId: string
  try {
    appId = metaAppId()
    metaRedirectUri()
  } catch (err) {
    console.error("[meta-oauth]", err instanceof Error ? err.message : err)
    const message = err instanceof Error ? err.message : "config"
    return settingsRedirect(
      "meta_error",
      message.includes("SECRET") ? "missing_app_secret" : "missing_app_id"
    )
  }

  const state = randomBytes(16).toString("hex")
  const authorize = new URL(`https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`)
  authorize.searchParams.set("client_id", appId)
  authorize.searchParams.set("redirect_uri", metaRedirectUri())
  authorize.searchParams.set("state", state)
  authorize.searchParams.set("scope", metaOAuthScopes())
  authorize.searchParams.set("response_type", "code")

  const response = HttpResponse.redirect(authorize)
  response.cookies.set(META_STATE_COOKIE, JSON.stringify({ state, entityId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/meta",
    maxAge: 10 * 60 * 1000,
  })
  return response
}
