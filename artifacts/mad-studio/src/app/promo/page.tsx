import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { CalendarTabs } from "@/components/layout/calendar-tabs"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { DotSpecialPanel } from "@/components/templates/dot-special"
import { WLS_STORY_KIT } from "@/lib/brands/story-kit"
import { resolveEntityType } from "@/lib/social-creative/resolve-entity-type"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Promo Builder",
}

type PromoPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function PromoPage({ searchParams }: PromoPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/promo")
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

  const entityType = resolveEntityType({
    name: activeSummary.name,
    industry: activeSummary.industry,
    entityId: activeSummary.id,
  })

  const organizationId =
    activeSummary.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  return (
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="flex flex-col overflow-hidden"
      entities={entities}
      activeEntityId={activeSummary.id}
      userEmail={user.email ?? null}
      isOrgAdmin={isOrgAdmin}
      organizationId={organizationId}
    >
        <CalendarTabs activeEntity={activeSummary} className="shrink-0" />
        <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 border-b-2 border-mad-black px-4 py-2">
          <h1 className="brand-typewriter text-xl text-mad-black">
            Promo Builder
          </h1>
          <p className="text-sm text-neutral-600">
            {entityType === "WORN_LABEL"
              ? "Colour dot special: Story, feed card and an A4 sheet for the shop. Also on Sale rack."
              : "Hospitality deal builder arrives in Phase 2."}
          </p>
        </div>

        {entityType === "WORN_LABEL" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <div className="mx-auto max-w-6xl">
              <DotSpecialPanel entityId={activeSummary.id} entityName={activeSummary.name} kit={WLS_STORY_KIT} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <p className="font-typewriter text-sm font-bold tracking-wider uppercase text-mad-black">
              Hospitality deal builder
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              FÜDI promo layouts (happy hour, lunch combo, flash deals) are
              coming in Phase 2. Switch to Worn Label Society to use the Color
              Dot Special generator today.
            </p>
          </div>
        )}
    </StudioAppShell>
  )
}
