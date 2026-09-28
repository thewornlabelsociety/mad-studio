import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/database.types"

type Db = SupabaseClient<Database>

const VIEW_ROLES = ["entity_manager", "creator", "viewer"] as const
const EDIT_ROLES = ["entity_manager", "creator"] as const

async function hasRpcAccess(
  supabase: Db,
  entityId: string,
  allowedRoles: readonly string[]
): Promise<{ allowed: boolean; rpcError: string | null }> {
  const { data, error } = await supabase.rpc("has_entity_access", {
    ent_id: entityId,
    allowed_roles: [...allowedRoles],
  })
  if (error) {
    return { allowed: false, rpcError: error.message }
  }
  return { allowed: Boolean(data), rpcError: null }
}

/** Fallback when `has_entity_access` RPC fails or returns false. */
async function fallbackEntityAccess(
  supabase: Db,
  userId: string,
  entityId: string
): Promise<boolean> {
  const { data: entity } = await supabase
    .from("entities")
    .select("id, organization_id")
    .eq("id", entityId)
    .maybeSingle()

  if (!entity) return false

  const { data: directAccess } = await supabase
    .from("entity_access")
    .select("entity_id")
    .eq("entity_id", entityId)
    .eq("user_id", userId)
    .maybeSingle()
  if (directAccess) return true

  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", entity.organization_id)
    .eq("user_id", userId)
    .maybeSingle()
  if (orgMember?.role === "org_admin") return true

  return false
}

export async function assertBrainEntityAccess(input: {
  supabase: Db
  userId: string
  entityId: string
  mode: "view" | "edit"
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const roles = input.mode === "edit" ? EDIT_ROLES : VIEW_ROLES
  const rpc = await hasRpcAccess(input.supabase, input.entityId, roles)

  if (rpc.allowed) {
    return { ok: true }
  }

  const fallback = await fallbackEntityAccess(
    input.supabase,
    input.userId,
    input.entityId
  )
  if (fallback) {
    return { ok: true }
  }

  const { data: entityExists } = await input.supabase
    .from("entities")
    .select("id")
    .eq("id", input.entityId)
    .maybeSingle()

  if (!entityExists) {
    return { ok: false, status: 404, error: "Entity not found." }
  }

  return {
    ok: false,
    status: 403,
    error:
      rpc.rpcError ??
      "You do not have access to this brand. Ask an org admin to grant entity access.",
  }
}
