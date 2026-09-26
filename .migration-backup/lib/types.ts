export const ENTITY_COOKIE = "mega_entity_id"

export const INVITE_ROLES = [
  "org_admin",
  "entity_manager",
  "creator",
  "viewer",
] as const

export type InviteRole = (typeof INVITE_ROLES)[number]

export const ORG_MEMBER_ROLES = ["org_admin", "staff", "viewer"] as const
export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number]

export const ENTITY_ACCESS_ROLES = [
  "entity_manager",
  "creator",
  "viewer",
] as const
export type EntityAccessRole = (typeof ENTITY_ACCESS_ROLES)[number]

export function isInviteRole(value: string): value is InviteRole {
  return (INVITE_ROLES as readonly string[]).includes(value)
}

export function roleRequiresEntity(role: InviteRole): boolean {
  return role === "entity_manager" || role === "creator"
}

export type AccessibleEntity = {
  id: string
  name: string
  organization_id: string
  industry: string
}

export type AcceptInvitationResult = {
  entity_id: string | null
  organization_id: string
  role: string
}
