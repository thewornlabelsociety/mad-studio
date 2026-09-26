"use server"

import { revalidatePath } from "@server/http-response"
import { cookies } from "@server/request-context"
import { redirect } from "@server/http-response"

import {
  entityDnaSchema,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
} from "@/lib/entities/dna-schema"
import type { Json } from "@/lib/database.types"
import { createClient } from "@/lib/supabase/server"
import { ENTITY_COOKIE } from "@/lib/types"

export type CreateEntityInput = {
  organizationId: string
  name: string
  websiteUrl: string
  dna: unknown
  social: Partial<Record<SocialPlatform, string>>
  outboundWebhookUrl?: string | null
}

export type CreateEntityResult =
  | { ok: true; entityId: string }
  | { ok: false; error: string }

function cleanHandle(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/^@/, "")
}

export async function createEntity(
  input: CreateEntityInput
): Promise<CreateEntityResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "You must be signed in." }
  }

  const name = input.name.trim()
  if (!name) {
    return { ok: false, error: "Brand name is required." }
  }

  const dnaParsed = entityDnaSchema.safeParse(input.dna)
  if (!dnaParsed.success) {
    return {
      ok: false,
      error: "Brand DNA is incomplete. Go back and calibrate before saving.",
    }
  }

  const dna = dnaParsed.data

  const { data: isMember, error: memberError } = await supabase.rpc(
    "is_org_member",
    { org_id: input.organizationId }
  )

  if (memberError) {
    return { ok: false, error: memberError.message }
  }

  if (!isMember) {
    return {
      ok: false,
      error: "You must belong to the organization to create a brand.",
    }
  }

  const { data: isAdmin, error: adminError } = await supabase.rpc(
    "is_org_admin",
    { org_id: input.organizationId }
  )

  if (adminError) {
    return { ok: false, error: adminError.message }
  }

  if (!isAdmin) {
    return {
      ok: false,
      error: "Only organization admins can initialize a new brand brain.",
    }
  }

  const websiteUrl = input.websiteUrl.trim() || null

  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .insert({
      organization_id: input.organizationId,
      name,
      website_url: websiteUrl,
      industry: dna.industry,
      business_model: dna.business_model,
      brand_identity: dna.brand_identity as unknown as Json,
      audience_segments: dna.audience_segments as unknown as Json,
      value_propositions: dna.value_propositions as unknown as Json,
      conversion_goals: dna.conversion_goals as unknown as Json,
      content_pillars: dna.content_pillars as unknown as Json,
      local_context: dna.local_context as unknown as Json,
    })
    .select("id")
    .single()

  if (entityError || !entity) {
    return {
      ok: false,
      error: entityError?.message ?? "Failed to create entity.",
    }
  }

  const entityId = entity.id

  const channelRows: Array<{
    entity_id: string
    platform: string
    account_name: string
    webhook_url: string | null
    credentials: Json
    is_active: boolean
  }> = []

  for (const platform of SOCIAL_PLATFORMS) {
    const accountName = cleanHandle(input.social[platform])
    if (!accountName) continue
    channelRows.push({
      entity_id: entityId,
      platform,
      account_name: accountName,
      webhook_url: null,
      credentials: {},
      is_active: true,
    })
  }

  const outbound = input.outboundWebhookUrl?.trim()
  if (outbound) {
    channelRows.push({
      entity_id: entityId,
      platform: "outbound",
      account_name: "Make / n8n Outbound",
      webhook_url: outbound,
      credentials: { type: "outbound_webhook" },
      is_active: true,
    })
  }

  if (channelRows.length > 0) {
    const { error: channelsError } = await supabase
      .from("entity_channels")
      .insert(channelRows)

    if (channelsError) {
      await supabase.from("entities").delete().eq("id", entityId)
      return {
        ok: false,
        error: `Entity created but channels failed: ${channelsError.message}`,
      }
    }
  }

  const { error: logError } = await supabase.from("activity_logs").insert({
    entity_id: entityId,
    user_id: user.id,
    action: "created_entity",
    details: {
      name,
      website_url: websiteUrl,
      industry: dna.industry,
      channels: channelRows.map((row) => row.platform),
    },
  })

  if (logError) {
    console.error("activity_logs insert failed:", logError.message)
  }

  const cookieStore = await cookies()
  cookieStore.set(ENTITY_COOKIE, entityId, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath("/studio")
  revalidatePath("/entities/new")
  redirect(`/studio?eid=${encodeURIComponent(entityId)}`)
}
