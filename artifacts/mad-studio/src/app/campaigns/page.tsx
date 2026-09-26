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
import type {
  AnalyticsSnapshot,
  CampaignLedgerItem,
} from "@/lib/campaigns/ledger"
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

  const campaignIds = (campaignRows ?? []).map((campaign) => campaign.id)
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

  const campaigns: CampaignLedgerItem[] = (campaignRows ?? []).map(
    (campaign) => ({
      ...campaign,
      analytics: analyticsByCampaign.get(campaign.id) ?? null,
    })
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
        />
      </main>
    </div>
  )
}
