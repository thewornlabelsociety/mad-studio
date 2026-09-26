import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { listSocialConnections } from "@/lib/actions"
import { AppTopbar } from "@/components/layout/app-topbar"
import { OutboundWebhookCard } from "@/components/settings/outbound-webhook-card"
import { SocialConnectionsPanel } from "@/components/settings/social-connections-panel"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Social Connections",
}

type SocialSettingsPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function SocialSettingsPage({
  searchParams,
}: SocialSettingsPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/settings/social")
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
    redirect(`/settings/social?eid=${encodeURIComponent(activeEntity.id)}`)
  }

  const organizationId =
    activeEntity.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const listed = await listSocialConnections({ entityId: activeEntity.id })
  const connections = listed.ok ? listed.data : []

  const { data: outboundChannel } = await supabase
    .from("entity_channels")
    .select("webhook_url")
    .eq("entity_id", activeEntity.id)
    .eq("platform", "outbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

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

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6">
        <section className="border-b-2 border-mad-black pb-4">
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Settings · Social
          </p>
          <h1 className="brand-typewriter mt-1 text-xl text-mad-black sm:text-2xl">
            Account Connection & Token Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600">
            Connect Instagram Business, Facebook Page, and TikTok credentials for
            in-house dispatch — plus an outbound webhook for Make / n8n / Zapier.
          </p>
          {!listed.ok ? (
            <p
              className="mt-3 border-2 border-mad-black bg-mad-vermillion px-3 py-2 text-sm font-bold text-mad-white"
              role="alert"
            >
              {listed.error}
            </p>
          ) : null}
        </section>

        <OutboundWebhookCard
          entityId={activeEntity.id}
          brandName={activeEntity.name}
          initialWebhookUrl={outboundChannel?.webhook_url ?? null}
        />

        <SocialConnectionsPanel
          entityId={activeEntity.id}
          brandName={activeEntity.name}
          initialConnections={connections}
        />
      </main>
    </div>
  )
}
