import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { BackButton } from "@/components/layout/back-button"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { WlsWantsWorkspace } from "@/components/templates/wls-wants-workspace"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Searching For",
}

type PageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function WlsWantsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/templates/wls-wants")
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const cookieEntityId = cookieStore.get(ENTITY_COOKIE)?.value ?? null
  const requestedEntityId = params.eid ?? params.entityId ?? cookieEntityId
  const activeSummary =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  if (!activeSummary) {
    redirect("/studio")
  }

  if (params.eid !== activeSummary.id) {
    redirect(
      `/templates/wls-wants?eid=${encodeURIComponent(activeSummary.id)}`
    )
  }

  const { data: entityRow } = await supabase
    .from("entities")
    .select("id, name, industry, organization_id, brand_identity")
    .eq("id", activeSummary.id)
    .maybeSingle()

  const organizationId =
    entityRow?.organization_id ??
    activeSummary.organization_id ??
    (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const brandIdentity =
    entityRow?.brand_identity &&
    typeof entityRow.brand_identity === "object" &&
    !Array.isArray(entityRow.brand_identity)
      ? (entityRow.brand_identity as { visual_presets?: unknown })
      : null

  return (
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="mx-auto flex w-full max-w-7xl flex-col overflow-hidden px-4 py-3"
      entities={entities}
      activeEntityId={activeSummary.id}
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
      <BackButton fallback={`/week?eid=${encodeURIComponent(activeSummary.id)}`} />
      <WlsWantsWorkspace
        entityId={activeSummary.id}
        entityName={entityRow?.name ?? activeSummary.name}
        industry={entityRow?.industry ?? activeSummary.industry}
        brandIdentity={brandIdentity as never}
      />
    </StudioAppShell>
  )
}
