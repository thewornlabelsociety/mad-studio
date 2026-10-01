import { cookies, redirect } from "@/lib/next-compat"
import { Suspense } from "react"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { CampaignsLedger } from "@/components/campaigns/campaigns-ledger"
import { CampaignsToast } from "@/components/campaigns/campaigns-toast"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import {
  ctrFromMetrics,
  isBrainMemoryVaultCampaign,
  type AnalyticsSnapshot,
  type CampaignLedgerItem,
  type CampaignQueuePost,
  type PublishedDropRow,
} from "@/lib/campaigns/ledger"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Drop Performance",
}

type CampaignsPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string; toast?: string }>
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

  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select(
      "id, title, status, target_goal, target_segment, created_at, published_at, outcome_rating, what_worked, what_didnt_work, ai_takeaway, asset_pack"
    )
    .eq("entity_id", activeEntity.id)
    .order("created_at", { ascending: false })

  const dropCampaignRows = (campaignRows ?? []).filter(
    (campaign) => !isBrainMemoryVaultCampaign(campaign)
  )

  const campaignIds = dropCampaignRows.map((campaign) => campaign.id)
  const analyticsByCampaign = new Map<string, AnalyticsSnapshot>()

  if (campaignIds.length > 0) {
    const { data: analyticsRows } = await supabase
      .from("ad_analytics")
      .select(
        "id, campaign_id, entity_id, spend, revenue, conversions_count, impressions, clicks, net_profit, roas, cpa, ctr, cpc, notes, reporting_date"
      )
      .in("campaign_id", campaignIds)
      .order("reporting_date", { ascending: false })

    for (const row of analyticsRows ?? []) {
      if (!analyticsByCampaign.has(row.campaign_id)) {
        analyticsByCampaign.set(row.campaign_id, row)
      }
    }
  }

  const queueByCampaign = new Map<string, CampaignQueuePost[]>()
  if (campaignIds.length > 0) {
    const { data: queueRows } = await supabase
      .from("scheduled_posts")
      .select(
        "id, campaign_id, marketing_entity_id, platform, mode, status, scheduled_time, published_at, last_error, attempts"
      )
      .eq("entity_id", activeEntity.id)
      .in("campaign_id", campaignIds)
      .neq("status", "cancelled")
      .order("scheduled_time", { ascending: true })

    for (const row of queueRows ?? []) {
      if (!row.campaign_id) continue
      const list = queueByCampaign.get(row.campaign_id) ?? []
      list.push(row)
      queueByCampaign.set(row.campaign_id, list)
    }
  }

  const campaigns: CampaignLedgerItem[] = dropCampaignRows.map((campaign) => ({
    ...campaign,
    analytics: analyticsByCampaign.get(campaign.id) ?? null,
    queue: queueByCampaign.get(campaign.id) ?? [],
  }))

  const { data: publishedEntityRows } = await supabase
    .from("marketing_entities")
    .select(
      "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
    )
    .eq("entity_id", activeEntity.id)
    .eq("status", "published")
    .order("published_at", { ascending: false })

  const { data: entityCampaignLinks } = await supabase
    .from("scheduled_posts")
    .select("marketing_entity_id, campaign_id")
    .eq("entity_id", activeEntity.id)
    .not("marketing_entity_id", "is", null)

  const marketingEntityToCampaign = new Map<string, string>()
  for (const link of entityCampaignLinks ?? []) {
    if (link.marketing_entity_id && link.campaign_id) {
      marketingEntityToCampaign.set(link.marketing_entity_id, link.campaign_id)
    }
  }

  const publishedDrops: PublishedDropRow[] = (publishedEntityRows ?? []).map(
    (row) => {
      const item = mapMarketingEntityRow(row)
      const campaignId = marketingEntityToCampaign.get(item.id)
      const analytics = campaignId
        ? analyticsByCampaign.get(campaignId)
        : null
      const clicks = Number(analytics?.clicks ?? item.metrics.clicks ?? 0)
      const spend = Number(analytics?.spend ?? 0)
      const cpcFromAnalytics =
        analytics?.cpc != null ? Number(analytics.cpc) : null
      return {
        id: item.id,
        title: item.title,
        thumbnailUrl: item.images[0]?.trim() || null,
        targetAudience:
          item.copy_draft?.metadata?.listing_vibe?.trim() ||
          item.vibe?.trim() ||
          null,
        ctrPercent: ctrFromMetrics(item.metrics),
        directConversions: Number(item.metrics.sales ?? 0),
        costPerClick:
          cpcFromAnalytics ??
          (clicks > 0 && spend > 0 ? spend / clicks : null),
        publishedAt: item.published_at,
      }
    }
  )

  return (
    <div className="flex min-h-svh flex-col bg-mad-white">
      <AppTopbar
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
      />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={null}>
          <CampaignsToast />
        </Suspense>
        <CampaignsLedger
          entityId={activeEntity.id}
          entityName={activeEntity.name}
          campaigns={campaigns}
          publishedDrops={publishedDrops}
        />
      </main>
    </div>
  )
}
