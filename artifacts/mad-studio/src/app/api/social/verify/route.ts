import { NextResponse } from "next/server"
import { z } from "zod"

import { verifyMetaConnection } from "@/lib/social/meta-publisher"
import { verifyTikTokConnection } from "@/lib/social/tiktok-publisher"
import { refreshTikTokConnectionIfNeeded } from "@/lib/social/tiktok-token-refresh"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const querySchema = z.object({
  entityId: z.string().uuid(),
  platform: z.enum(["instagram", "facebook", "tiktok"]),
  connectionId: z.string().uuid().optional(),
  accountId: z.string().min(1).max(200).optional(),
  accessToken: z.string().min(1).max(5000).optional(),
})

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      entityId: url.searchParams.get("entityId"),
      platform: url.searchParams.get("platform"),
      connectionId: url.searchParams.get("connectionId") || undefined,
      accountId: url.searchParams.get("accountId") || undefined,
      accessToken: url.searchParams.get("accessToken") || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: "entityId and platform are required." },
        { status: 400 }
      )
    }

    const input = parsed.data
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: canAccess, error: accessError } = await supabase.rpc(
      "has_entity_access",
      {
        ent_id: input.entityId,
        allowed_roles: ["entity_manager", "creator", "viewer"],
      }
    )
    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 })
    }
    if (!canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let accountId = input.accountId?.trim() || ""
    let accessToken = input.accessToken?.trim() || ""

    if (!accountId || !accessToken) {
      let query = supabase
        .from("social_connections")
        .select(
          input.platform === "tiktok"
            ? "id, entity_id, account_id, access_token, account_name, is_active, refresh_token, token_expires_at"
            : "id, account_id, access_token, account_name, is_active"
        )
        .eq("entity_id", input.entityId)
        .eq("platform", input.platform)
        .eq("is_active", true)

      if (input.connectionId) {
        query = query.eq("id", input.connectionId)
      }

      const { data: connection, error } = await query.maybeSingle()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (!connection) {
        return NextResponse.json(
          {
            ok: false,
            status: "not_configured",
            message: "Not Configured — save account ID and token first.",
          },
          { status: 400 }
        )
      }
      accountId = accountId || connection.account_id
      accessToken = accessToken || connection.access_token
      if (input.platform === "tiktok" && "refresh_token" in connection) {
        const refreshed = await refreshTikTokConnectionIfNeeded(createAdminClient(), {
          id: connection.id,
          entity_id: connection.entity_id,
          account_id: connection.account_id,
          account_name: connection.account_name,
          access_token: connection.access_token,
          refresh_token: connection.refresh_token,
          token_expires_at: connection.token_expires_at,
        })
        if (refreshed.ok) {
          accessToken = refreshed.accessToken
        }
      }
    }

    if (input.platform === "tiktok") {
      const verified = await verifyTikTokConnection({ accessToken, accountId })
      if (!verified.ok) {
        return NextResponse.json(
          {
            ok: false,
            status: "error",
            message: verified.error,
          },
          { status: verified.status }
        )
      }

      if (input.connectionId || (!input.accessToken && !input.accountId)) {
        await supabase
          .from("social_connections")
          .update({
            account_name: verified.accountName,
            updated_at: new Date().toISOString(),
          })
          .eq("entity_id", input.entityId)
          .eq("platform", "tiktok")
          .eq("is_active", true)
      }

      return NextResponse.json({
        ok: true,
        status: "verified",
        message: verified.message,
        accountId: verified.accountId,
        accountName: verified.accountName,
        platform: "tiktok",
      })
    }

    const verified = await verifyMetaConnection({
      platform: input.platform,
      accountId,
      accessToken,
    })

    if (input.connectionId || (!input.accessToken && !input.accountId)) {
      await supabase
        .from("social_connections")
        .update({
          account_name: verified.accountName,
          updated_at: new Date().toISOString(),
        })
        .eq("entity_id", input.entityId)
        .eq("platform", input.platform)
        .eq("is_active", true)
    }

    return NextResponse.json({
      ok: true,
      status: "verified",
      message: verified.message,
      accountId: verified.accountId,
      accountName: verified.accountName,
      platform: verified.platform,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection test failed."
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message,
      },
      { status: 400 }
    )
  }
}
