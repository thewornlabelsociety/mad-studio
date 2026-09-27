import { timingSafeEqual } from "crypto"

import { HttpResponse, type WebRequest } from "@server/http-response"

import {
  META_STATE_COOKIE,
  metaAppId,
  metaAppSecret,
  metaGraphBase,
  metaPublicSiteUrl,
  metaRedirectUri,
  parseStateCookie,
} from "@/lib/social/meta-oauth"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type MetaPageAccount = {
  id: string
  name: string
  access_token: string
  instagram_business_account?: { id: string; username?: string } | null
}

function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function finish(status: string, reason?: string, entityId?: string) {
  const url = new URL("/settings/social", metaPublicSiteUrl())
  url.searchParams.set("status", status)
  if (reason) url.searchParams.set("reason", reason.slice(0, 160))
  if (entityId) url.searchParams.set("eid", entityId)
  const response = HttpResponse.redirect(url)
  response.cookies.set(META_STATE_COOKIE, "", {
    path: "/api/auth/meta",
    maxAge: 0,
  })
  return response
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${metaGraphBase()}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const response = await fetch(url.toString(), {
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string; type?: string; code?: number }
  }
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Meta Graph ${path} failed (${response.status})`)
  }
  return body
}

export async function GET(request: WebRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get("code")
  const state = params.get("state")
  const error = params.get("error")

  if (error || !code) {
    return finish(
      "meta_error",
      params.get("error_description") || error || "missing_code"
    )
  }

  const saved = parseStateCookie(
    request.cookies.getAll().find((c) => c.name === META_STATE_COOKIE)?.value
  )
  if (!saved || !state || !statesMatch(saved.state, state)) {
    return finish("meta_error", "state_mismatch")
  }

  let appId: string
  let appSecret: string
  let redirectUri: string
  try {
    appId = metaAppId()
    appSecret = metaAppSecret()
    redirectUri = metaRedirectUri()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[meta-oauth]", message)
    return finish(
      "meta_error",
      message.includes("SECRET") ? "missing_app_secret" : "missing_app_id"
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return finish("meta_error", "signed_out")

  try {
    const shortLived = await graphGet<{ access_token?: string }>("/oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    })
    const shortToken = shortLived.access_token?.trim()
    if (!shortToken) return finish("meta_error", "token_exchange_failed", saved.entityId)

    const longLived = await graphGet<{ access_token?: string }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    })
    const userToken = longLived.access_token?.trim()
    if (!userToken) return finish("meta_error", "long_lived_exchange_failed", saved.entityId)

    const accountsPayload = await graphGet<{ data?: MetaPageAccount[] }>("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      access_token: userToken,
    })
    const pages = accountsPayload.data ?? []
    if (pages.length === 0) {
      return finish("meta_error", "no_facebook_pages", saved.entityId)
    }

    const page =
      pages.find((row) => row.instagram_business_account?.id) ?? pages[0]
    const pageToken = page.access_token?.trim()
    const pageId = page.id?.trim()
    const pageName = page.name?.trim() || "Facebook Page"
    if (!pageToken || !pageId) {
      return finish("meta_error", "page_token_missing", saved.entityId)
    }

    const now = new Date().toISOString()
    const rows: Array<{
      entity_id: string
      platform: "instagram" | "facebook"
      account_id: string
      account_name: string
      access_token: string
      is_active: boolean
      updated_at: string
    }> = [
      {
        entity_id: saved.entityId,
        platform: "facebook",
        account_id: pageId,
        account_name: pageName,
        access_token: pageToken,
        is_active: true,
        updated_at: now,
      },
    ]

    const ig = page.instagram_business_account
    if (ig?.id) {
      rows.unshift({
        entity_id: saved.entityId,
        platform: "instagram",
        account_id: ig.id.trim(),
        account_name: ig.username?.trim() || "Instagram",
        access_token: pageToken,
        is_active: true,
        updated_at: now,
      })
    }

    const { error: saveError } = await supabase
      .from("social_connections")
      .upsert(rows, { onConflict: "entity_id,platform,account_id" })
    if (saveError) return finish("meta_error", saveError.message, saved.entityId)

    return finish("meta_connected", undefined, saved.entityId)
  } catch (err) {
    return finish(
      "meta_error",
      err instanceof Error ? err.message : "unexpected_error",
      saved.entityId
    )
  }
}
