import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { QueueCard } from "@/components/today/queue-card"
import { looksLikeFashionCatalogContamination } from "@/lib/inventory/entity-intake"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import { buildTodayQueueView } from "@/lib/today/queue"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Today",
}

type TodayPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/today")
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
    redirect(`/today?eid=${encodeURIComponent(activeEntity.id)}`)
  }

  const organizationId =
    activeEntity.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const activeEntityId = activeEntity.id
  const isFudi = isFudiStudioEntity({
    name: activeEntity.name,
    industry: activeEntity.industry,
  })

  const { data: entityRow } = await supabase
    .from("entities")
    .select("website_url")
    .eq("id", activeEntityId)
    .maybeSingle()

  const { data: rows } = await supabase
    .from("marketing_entities")
    .select(
      "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
    )
    .eq("entity_id", activeEntityId)
    .in("status", ["unfeatured", "draft"])
    .order("created_at", { ascending: false })
    .limit(10)

  const mapped = (rows ?? [])
    .filter((row) => row.entity_id === activeEntityId)
    .map(mapMarketingEntityRow)
    .filter((item) =>
      isFudi ? !looksLikeFashionCatalogContamination(item) : true
    )

  const queue = mapped.map((item) =>
    buildTodayQueueView({
      item,
      brandName: activeEntity.name,
      industry: activeEntity.industry,
    })
  )
  const unfeaturedCount = queue.length

  return (
    <div className="flex min-h-svh flex-col bg-neutral-50">
      <AppTopbar
        entities={entities}
        activeEntityId={activeEntityId}
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

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
        <section className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-mad-black pb-4">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Daily Command Hub
            </p>
            <h1 className="mt-1 font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase sm:text-3xl">
              TODAY&apos;S SLATE // {activeEntity.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Pull fresh arrivals, then send each drop into Studio to craft,
              schedule, and dispatch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PullNewArrivalsButton entityId={activeEntityId} />
            <span className="border-2 border-mad-black bg-mad-lime px-3 py-2 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-black uppercase shadow-keycap-sm">
              {unfeaturedCount} pending
            </span>
          </div>
        </section>

        {queue.length === 0 ? (
          <section className="border-2 border-dashed border-mad-black/40 bg-mad-white px-6 py-16 text-center shadow-keycap-sm">
            <p className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
              Slate clear
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              No unfeatured or draft drops for {activeEntity.name}. Use Pull New
              Arrivals / Feed above, or open Studio for a scratch drop.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {queue.map((view) => (
              <QueueCard
                key={view.item.id}
                view={view}
                entityId={activeEntityId}
                brandName={activeEntity.name}
                websiteUrl={entityRow?.website_url ?? null}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  )
}
