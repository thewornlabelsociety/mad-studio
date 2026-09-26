import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { EntitySetupWizard } from "@/components/entities/entity-setup-wizard"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Add New Brand",
}

export default async function NewEntityPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/entities/new")
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const activeEntityId =
    cookieStore.get(ENTITY_COOKIE)?.value ?? entities[0]?.id ?? null
  const organizationId =
    entities.find((entity) => entity.id === activeEntityId)?.organization_id ??
    (await getActiveOrganizationId(user.id))

  if (!organizationId) {
    redirect("/studio?error=" + encodeURIComponent("Join an organization first."))
  }

  const isOrgAdmin = await isCurrentUserOrgAdmin(organizationId)
  if (!isOrgAdmin) {
    redirect(
      "/studio?error=" +
        encodeURIComponent("Only organization admins can add a new brand.")
    )
  }

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <AppTopbar
        entities={entities}
        activeEntityId={activeEntityId}
        userEmail={user.email ?? null}
        isOrgAdmin={isOrgAdmin}
        organizationId={organizationId}
        teamSlot={
          <TeamInviteModal
            organizationId={organizationId}
            entities={entities}
          />
        }
      />
      <main className="flex-1 px-4 py-10">
        <EntitySetupWizard organizationId={organizationId} />
      </main>
    </div>
  )
}
