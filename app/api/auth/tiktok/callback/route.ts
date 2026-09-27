import { timingSafeEqual } from "crypto"
import { NextResponse, type NextRequest } from "next/server"

import {
  parseStateCookie,
  TIKTOK_STATE_COOKIE,
  tiktokClientKey,
  tiktokRedirectUri,
} from "@/lib/social/tiktok-oauth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function finish(request: NextRequest, status: string, reason?: string) {
  const url = new URL("/settings/social", request.url)
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason.slice(0, 160))
  const response = NextResponse.redirect(url)
  response.cookies.delete({ name: TIKTOK_STATE_COOKIE, path: "/api/auth/tiktok" })
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

  const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim()
  if (!clientSecret) {
    return finish(request, "tiktok_error", "missing_client_secret")
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
        client_key: tiktokClientKey(),
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: tiktokRedirectUri(),
      }),
    })
    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      open_id?: string
      error?: string
      error_description?: string
      data?: { access_token?: string; open_id?: string }
    }
    const accessToken = tokenData.access_token ?? tokenData.data?.access_token
    const openId = tokenData.open_id ?? tokenData.data?.open_id
    if (!tokenRes.ok || tokenData.error || !accessToken || !openId) {
      return finish(
        request,
        "tiktok_error",
        tokenData.error_description || tokenData.error || "token_exchange_failed"
      )
    }

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
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_id,platform,account_id" }
    )
    if (saveError) return finish(request, "tiktok_error", saveError.message)

    return finish(request, "tiktok_connected")
  } catch (err) {
    return finish(
      request,
      "tiktok_error",
      err instanceof Error ? err.message : "unexpected_error"
    )
  }
}
