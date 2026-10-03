import { createClient } from "@/lib/supabase/client"
import type { AccessibleEntity } from "@/lib/types"

/** Browser Supabase reads for workspace bootstrap (no API server required). */
export async function getAccessibleEntitiesClient(
  userId: string
): Promise<AccessibleEntity[]> {
  const supabase = createClient()
  const byId = new Map<string, AccessibleEntity>()

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)

  const adminOrgIds =
    memberships
      ?.filter((member) => member.role === "org_admin")
      .map((member) => member.organization_id) ?? []

  if (adminOrgIds.length > 0) {
    const { data: orgEntities } = await supabase
      .from("entities")
      .select("id, name, organization_id, industry")
      .in("organization_id", adminOrgIds)

    for (const entity of orgEntities ?? []) {
      byId.set(entity.id, entity)
    }
  }

  const { data: accessRows } = await supabase
    .from("entity_access")
    .select("entity_id")
    .eq("user_id", userId)

  const accessEntityIds = (accessRows ?? []).map((row) => row.entity_id)
  if (accessEntityIds.length > 0) {
    const { data: accessEntities } = await supabase
      .from("entities")
      .select("id, name, organization_id, industry")
      .in("id", accessEntityIds)

    for (const entity of accessEntities ?? []) {
      byId.set(entity.id, entity)
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getActiveOrganizationIdClient(
  userId: string
): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "org_admin")
    .limit(1)
    .maybeSingle()

  return data?.organization_id ?? null
}

export async function isCurrentUserOrgAdminClient(
  organizationId: string
): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("is_org_admin", {
    org_id: organizationId,
  })
  if (error) return false
  return Boolean(data)
}
