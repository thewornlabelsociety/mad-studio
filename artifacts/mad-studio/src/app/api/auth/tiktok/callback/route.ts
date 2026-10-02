import { timingSafeEqual } from "crypto"
import { NextResponse, type NextRequest } from "next/server"

import {
  parseStateCookie,
  TIKTOK_STATE_COOKIE,
  tiktokClientKey,
  tiktokClientSecret,
  tiktokRedirectUri,
} from "@/lib/social/tiktok-oauth"
import {
  parseTikTokOAuthTokenPayload,
  tiktokOAuthTokenErrorMessage,
  tokenExpiresAtFromExpiresIn,
  type TikTokOAuthTokenPayload,
} from "@/lib/social/tiktok-token-refresh"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function finish(
  request: NextRequest,
  status: string,
  reason?: string,
  entityId?: string
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
  const url = new URL("/settings/social", baseUrl)
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason.slice(0, 160))
  if (entityId) url.searchParams.set("eid", entityId)
  const response = NextResponse.redirect(url)
  response.cookies.set(TIKTOK_STATE_COOKIE, "", {
    path: "/api/auth/tiktok",
    maxAge: 0,
  })
  return response
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const state = params.get("state")
  const error = params.get("error")

  if (error || !code) {
    return finish(
      request,
      "tiktok_error",
      params.get("error_description") || error || "missing_code"
    )
  }

  const saved = parseStateCookie(request.cookies.get(TIKTOK_STATE_COOKIE)?.value)
  if (!saved || !state || !statesMatch(saved.state, state)) {
    return finish(request, "tiktok_error", "state_mismatch")
  }

  let clientKey: string
  let clientSecret: string
  try {
    clientKey = tiktokClientKey()
    clientSecret = tiktokClientSecret()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[tiktok-oauth]", message)
    return finish(
      request,
      "tiktok_error",
      message.includes("SECRET") ? "missing_client_secret" : "missing_client_key"
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return finish(request, "tiktok_error", "signed_out")

  try {
    const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: tiktokRedirectUri(),
      }),
    })
    const tokenData = (await tokenRes.json()) as TikTokOAuthTokenPayload
    const parsedTokens = parseTikTokOAuthTokenPayload(tokenData)
    const openId = parsedTokens?.openId
    if (!tokenRes.ok || tokenData.error || !parsedTokens || !openId) {
      return finish(
        request,
        "tiktok_error",
        tokenData.error
          ? tiktokOAuthTokenErrorMessage(tokenData)
          : "token_exchange_failed"
      )
    }
    const accessToken = parsedTokens.accessToken

    const userRes = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const userData = (await userRes.json().catch(() => null)) as {
      data?: { user?: { display_name?: string } }
    } | null
    const displayName = userData?.data?.user?.display_name || "TikTok Account"

    const { error: saveError } = await supabase.from("social_connections").upsert(
      {
        entity_id: saved.entityId,
        platform: "tiktok",
        account_id: openId,
        account_name: displayName,
        access_token: accessToken,
        refresh_token: parsedTokens.refreshToken,
        token_expires_at:
          parsedTokens.expiresIn != null
            ? tokenExpiresAtFromExpiresIn(parsedTokens.expiresIn)
            : null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_id,platform,account_id" }
    )
    if (saveError) {
      return finish(request, "tiktok_error", saveError.message, saved.entityId)
    }

    return finish(request, "tiktok_connected", undefined, saved.entityId)
  } catch (err) {
    return finish(
      request,
      "tiktok_error",
      err instanceof Error ? err.message : "unexpected_error"
    )
  }
}
