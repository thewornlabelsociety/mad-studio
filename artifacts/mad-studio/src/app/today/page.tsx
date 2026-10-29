import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import {
  TodayCommandDashboard,
  type ArmedTodayRow,
} from "@/components/today/today-command-dashboard"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  formatAgendaLiveDate,
  getLocalDayBounds,
  resolveBrainDirective,
} from "@/lib/today/agenda"
import { readDispatchCronHealth } from "@/lib/cron/read-dispatch-health"
import { resolveIntakeCaptionDefaultSource } from "@/lib/inventory/intake-caption-default"
import { fetchPendingTodayDeck } from "@/lib/today/daily-queue"
import { MorningStoryFeed } from "@/components/today/morning-story-feed"
import { WeekOutfitsLink } from "@/components/today/week-outfits-link"
import { TodayActionDeck } from "@/components/today/action-deck"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"
import { TodayChecklist } from "@/components/today/today-checklist"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"
import type { VisualPresets } from "@/lib/entities/dna-schema"

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

  const { data: entityRow } = await supabase
    .from("entities")
    .select(
      "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
    )
    .eq("id", activeEntityId)
    .maybeSingle()

  const entityDna = entityRow ? parseStudioEntity(entityRow) : null
  const intakeCaptionDefault = resolveIntakeCaptionDefaultSource(
    entityDna?.brand_identity ?? null
  )

  const [
    { count: unfeaturedCountRaw },
    { count: failedDispatchCountRaw },
    { data: takeawayRows },
    { data: scheduledRows },
  ] = await Promise.all([
    supabase
      .from("marketing_entities")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", activeEntityId)
      .eq("status", "unfeatured"),
    supabase
      .from("scheduled_posts")
      .select("id", { count: "exact", head: true })
      .eq("entity_id", activeEntityId)
      .eq("status", "failed"),
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
  const failedDispatchCount = failedDispatchCountRaw ?? 0

  const dispatchCronHealth = await readDispatchCronHealth()

  const deck = await fetchPendingTodayDeck({
    supabase,
    entityId: activeEntityId,
    brandName: activeEntity.name,
    industry: activeEntity.industry,
  })

  const queue = deck

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

  const isWls = isWornLabelFashionEntity({
    name: activeEntity.name,
    industry: activeEntity.industry,
  })
  const storyBrandIdentity =
    entityRow?.brand_identity &&
    typeof entityRow.brand_identity === "object" &&
    !Array.isArray(entityRow.brand_identity)
      ? (entityRow.brand_identity as { visual_presets?: VisualPresets | null })
      : null

  return (
    <StudioAppShell
      entities={entities}
      activeEntityId={activeEntityId}
      userEmail={user.email ?? null}
      isOrgAdmin={isOrgAdmin}
      organizationId={organizationId}
      mainClassName="mx-auto flex w-full max-w-[100rem] flex-col md:px-2"
      teamSlot={
        isOrgAdmin && organizationId ? (
          <TeamInviteModal
            organizationId={organizationId}
            entities={entities}
          />
        ) : null
      }
    >
        <div className="min-h-0 flex-1 overflow-y-auto md:hidden">
          {isWls ? (
            <MorningStoryFeed
              entityId={activeEntityId}
              entityName={activeEntity.name}
              industry={activeEntity.industry}
              brandIdentity={storyBrandIdentity}
              className="mx-3 mt-3"
            />
          ) : null}
          {isWls ? (
            <WeekOutfitsLink entityId={activeEntityId} className="mx-3 mt-2" />
          ) : null}
          <TodayChecklist
            entityId={activeEntityId}
            failedCount={failedDispatchCount}
            scheduledCount={armedRows.length}
            newDropsCount={deck.length}
            newDropsHref="#todays-deck"
            className="mx-3 mt-3"
          />
          <div id="todays-deck" className="scroll-mt-4">
          <TodayActionDeck
            entityId={activeEntityId}
            entityName={activeEntity.name}
            industry={activeEntity.industry}
            websiteUrl={entityRow?.website_url ?? null}
            liveDateLabel={formatAgendaLiveDate()}
            initialDeck={deck}
          />
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 md:flex">
          {isWls ? (
            <MorningStoryFeed
              entityId={activeEntityId}
              entityName={activeEntity.name}
              industry={activeEntity.industry}
              brandIdentity={storyBrandIdentity}
              compact
              className="mb-3 shrink-0"
            />
          ) : null}
          {isWls ? (
            <WeekOutfitsLink entityId={activeEntityId} className="mb-3 shrink-0" />
          ) : null}
          <TodayCommandDashboard
            entityId={activeEntityId}
            entityName={activeEntity.name}
            industry={activeEntity.industry}
            websiteUrl={entityRow?.website_url ?? null}
            liveDateLabel={formatAgendaLiveDate()}
            brainDirective={brainDirective}
            unfeaturedCount={unfeaturedCount}
            armedCount={armedRows.length}
            initialQueue={queue}
            armedRows={armedRows}
            dispatchCronHealth={dispatchCronHealth}
            failedDispatchCount={failedDispatchCount}
            intakeCaptionDefault={intakeCaptionDefault}
          />
        </div>
    </StudioAppShell>
  )
}
