import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { HelpCenter } from "@/components/help/help-center"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Help",
}

type HelpPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function HelpPage({ searchParams }: HelpPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/help")
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const cookieEntityId = cookieStore.get(ENTITY_COOKIE)?.value ?? null
  const requestedEntityId = params.eid ?? params.entityId ?? cookieEntityId
  const activeSummary =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  const organizationId =
    activeSummary?.organization_id ??
    (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const entityQuery = activeSummary
    ? `?eid=${encodeURIComponent(activeSummary.id)}`
    : ""

  return (
    <div className="flex min-h-svh flex-col bg-mad-white">
      <AppTopbar
        entities={entities}
        activeEntityId={activeSummary?.id ?? null}
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
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <HelpCenter entityQuery={entityQuery} />
      </main>
    </div>
  )
}
