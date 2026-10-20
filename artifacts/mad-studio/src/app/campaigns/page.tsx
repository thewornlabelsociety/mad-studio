import { cookies, redirect } from "@/lib/next-compat"
import { Suspense } from "react"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { CampaignsWorkspace } from "@/components/campaigns/campaigns-workspace"
import { CampaignsToast } from "@/components/campaigns/campaigns-toast"
import { CalendarTabs } from "@/components/layout/calendar-tabs"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Campaigns",
}

type CampaignsPageProps = {
  searchParams: Promise<{
    eid?: string
    entityId?: string
    programId?: string
    toast?: string
  }>
}

export default async function CampaignsPage({
  searchParams,
}: CampaignsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/campaigns")
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
    redirect(`/campaigns?eid=${encodeURIComponent(activeEntity.id)}`)
  }

  const organizationId =
    activeEntity.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  return (
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="mx-auto flex w-full max-w-7xl flex-col overflow-hidden px-4 py-3"
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
        <CalendarTabs
          activeEntity={activeEntity}
          className="mb-3 shrink-0 rounded-md border"
        />
        <Suspense fallback={null}>
          <CampaignsToast />
        </Suspense>
        <CampaignsWorkspace
          entityId={activeEntity.id}
          entityName={activeEntity.name}
          programId={params.programId ?? null}
        />
    </StudioAppShell>
  )
}
