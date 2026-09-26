import { cookies, redirect } from "@/lib/next-compat"
import { Suspense } from "react"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { EntityMeteringDashboard } from "@/components/analytics/entity-metering-dashboard"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import {
  extractSpokenHook,
  parseMeteringRange,
  rangeStartIso,
  type MeteringRow,
  type OperationalHealth,
} from "@/lib/analytics/metering"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Usage & Cost",
}

type AnalyticsPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string; range?: string }>
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/analytics")
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

  const range = parseMeteringRange(params.range)

  if (params.eid !== activeEntity.id || params.range !== range) {
    redirect(
      `/analytics?eid=${encodeURIComponent(activeEntity.id)}&range=${range}`
    )
  }

  const organizationId =
    activeEntity.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const since = rangeStartIso(range)
  let meteringQuery = supabase
    .from("entity_agent_metering")
    .select(
      "id, agent_type, agent_label, model_used, provider, prompt_tokens, completion_tokens, total_tokens, raw_cost_usd, raw_cost_nzd, duration_ms, summary, created_at"
    )
    .eq("entity_id", activeEntity.id)
    .order("created_at", { ascending: false })
    .limit(500)

  if (since) {
    meteringQuery = meteringQuery.gte("created_at", since)
  }

  const { data: meteringRows } = await meteringQuery
  const rows: MeteringRow[] = (meteringRows ?? []).map((row) => ({
    ...row,
    prompt_tokens: Number(row.prompt_tokens),
    completion_tokens: Number(row.completion_tokens),
    total_tokens: Number(row.total_tokens),
    raw_cost_usd: Number(row.raw_cost_usd),
    raw_cost_nzd: Number(row.raw_cost_nzd),
    duration_ms: Number(row.duration_ms),
  }))

  const { count: packsGenerated } = await supabase
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", activeEntity.id)

  const { data: analyticsRows } = await supabase
    .from("ad_analytics")
    .select("campaign_id, roas, spend, revenue")
    .eq("entity_id", activeEntity.id)

  const loggedCampaignIds = new Set(
    (analyticsRows ?? [])
      .filter((row) => Number(row.spend) > 0 || Number(row.revenue) > 0)
      .map((row) => row.campaign_id)
  )

  const topByRoas = [...(analyticsRows ?? [])]
    .filter((row) => row.roas != null && Number(row.roas) > 0)
    .sort((a, b) => Number(b.roas) - Number(a.roas))
    .slice(0, 5)

  const topCampaignIds = topByRoas.map((row) => row.campaign_id)
  const hookByCampaign = new Map<
    string,
    { title: string; spokenHook: string; roas: number }
  >()

  if (topCampaignIds.length > 0) {
    const { data: campaignRows } = await supabase
      .from("campaigns")
      .select("id, title, algorithmic_signals")
      .in("id", topCampaignIds)

    for (const campaign of campaignRows ?? []) {
      const spokenHook = extractSpokenHook(campaign.algorithmic_signals)
      if (!spokenHook) continue
      const analytics = topByRoas.find((row) => row.campaign_id === campaign.id)
      if (!analytics?.roas) continue
      hookByCampaign.set(campaign.id, {
        title: campaign.title,
        spokenHook,
        roas: Number(analytics.roas),
      })
    }
  }

  const health: OperationalHealth = {
    packsGenerated: packsGenerated ?? 0,
    campaignsLogged: loggedCampaignIds.size,
    topHooks: topByRoas
      .map((row) => {
        const hook = hookByCampaign.get(row.campaign_id)
        if (!hook) return null
        return {
          campaignId: row.campaign_id,
          title: hook.title,
          spokenHook: hook.spokenHook,
          roas: hook.roas,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .slice(0, 3),
  }

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
          <EntityMeteringDashboard
            entityId={activeEntity.id}
            entityName={activeEntity.name}
            range={range}
            rows={rows}
            health={health}
          />
        </Suspense>
      </main>
    </div>
  )
}
