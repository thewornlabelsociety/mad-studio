import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { PlannerWorkspace } from "@/components/planner/planner-workspace"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Planner",
}

type PlannerPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/planner")
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const cookieEntityId = cookieStore.get(ENTITY_COOKIE)?.value ?? null
  const requestedEntityId = params.eid ?? params.entityId ?? cookieEntityId
  const activeEntity =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  if (!activeEntity) {
    redirect("/studio")
  }

  if (params.eid !== activeEntity.id) {
    redirect(`/planner?eid=${encodeURIComponent(activeEntity.id)}`)
  }

  const organizationId =
    activeEntity.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  return (
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="flex min-h-0 flex-col overflow-hidden"
      entities={entities}
      activeEntityId={activeEntity.id}
      userEmail={user.email ?? null}
      isOrgAdmin={isOrgAdmin}
      organizationId={organizationId}
      teamSlot={
        isOrgAdmin && organizationId ? (
          <TeamInviteModal
            organizationId={organizationId}
            entities={entities}
          />
        ) : null
      }
    >
      <PlannerWorkspace entityId={activeEntity.id} />
    </StudioAppShell>
  )
}
