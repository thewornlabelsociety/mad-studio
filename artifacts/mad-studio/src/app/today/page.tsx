import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import {
  TodayCommandDashboard,
  type ArmedTodayRow,
} from "@/components/today/today-command-dashboard"
import { looksLikeFashionCatalogContamination } from "@/lib/inventory/entity-intake"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { isFudiStudioEntity } from "@/lib/studio/fudi-tracks"
import {
  formatAgendaLiveDate,
  getLocalDayBounds,
  resolveBrainDirective,
} from "@/lib/today/agenda"
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
    .select(
      "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
    )
    .eq("id", activeEntityId)
    .maybeSingle()

  const entityDna = entityRow ? parseStudioEntity(entityRow) : null

  const [
    { count: unfeaturedCountRaw },
    { data: rows },
    { data: takeawayRows },
    { data: scheduledRows },
  ] = await Promise.all([
    supabase
      .from("marketing_entities")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", activeEntityId)
      .eq("status", "unfeatured"),
    supabase
      .from("marketing_entities")
      .select(
        "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
      )
      .eq("entity_id", activeEntityId)
      .eq("status", "unfeatured")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("campaigns")
      .select("ai_takeaway")
      .eq("entity_id", activeEntityId)
      .not("ai_takeaway", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1),
    (() => {
      const { start, end } = getLocalDayBounds()
      return supabase
        .from("scheduled_posts")
        .select(
          "id, platform, scheduled_time, status, caption, campaign_id, marketing_entity_id"
        )
        .eq("entity_id", activeEntityId)
        .eq("status", "scheduled")
        .gte("scheduled_time", start.toISOString())
        .lte("scheduled_time", end.toISOString())
        .order("scheduled_time", { ascending: true })
    })(),
  ])

  const unfeaturedCount = unfeaturedCountRaw ?? 0

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

  const campaignIds = [
    ...new Set(
      (scheduledRows ?? [])
        .map((row) => row.campaign_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const marketingIds = [
    ...new Set(
      (scheduledRows ?? [])
        .map((row) => row.marketing_entity_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const [{ data: campaignTitles }, { data: marketingTitles }] =
    await Promise.all([
      campaignIds.length
        ? supabase.from("campaigns").select("id, title").in("id", campaignIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      marketingIds.length
        ? supabase
            .from("marketing_entities")
            .select("id, title")
            .in("id", marketingIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ])

  const titleByCampaign = new Map(
    (campaignTitles ?? []).map((row) => [row.id, row.title])
  )
  const titleByMarketing = new Map(
    (marketingTitles ?? []).map((row) => [row.id, row.title])
  )

  const armedRows: ArmedTodayRow[] = (scheduledRows ?? []).map((row) => {
    const fromCampaign = row.campaign_id
      ? titleByCampaign.get(row.campaign_id)
      : null
    const fromItem = row.marketing_entity_id
      ? titleByMarketing.get(row.marketing_entity_id)
      : null
    const caption =
      typeof row.caption === "string" ? row.caption.trim().slice(0, 80) : ""
    return {
      id: row.id,
      platform: row.platform,
      scheduledTime: row.scheduled_time,
      title: fromCampaign || fromItem || caption || "Scheduled post",
      status: row.status,
    }
  })

  const brainDirective = entityDna
    ? resolveBrainDirective(
        entityDna,
        takeawayRows?.[0]?.ai_takeaway as string | undefined
      )
    : "Load Brand Brain to set seasonal focus."

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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <TodayCommandDashboard
          entityId={activeEntityId}
          entityName={activeEntity.name}
          industry={activeEntity.industry}
          liveDateLabel={formatAgendaLiveDate()}
          brainDirective={brainDirective}
          unfeaturedCount={unfeaturedCount}
          armedCount={armedRows.length}
          initialQueue={queue}
          armedRows={armedRows}
        />
      </main>
    </div>
  )
}
