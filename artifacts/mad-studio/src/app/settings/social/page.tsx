import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { listSocialConnections } from "@/lib/actions"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
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
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4"
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
    >
        <section className="border-b-2 border-mad-black pb-3">
          <p className="font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Settings · Social
          </p>
          <h1 className="brand-typewriter mt-1 text-xl text-mad-black">
            Connected accounts
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Connect Instagram, Facebook and TikTok so Studio can post for {activeEntity.name}.
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

        <SocialConnectionsPanel
          entityId={activeEntity.id}
          brandName={activeEntity.name}
          initialConnections={connections}
        />

        <details className="group border-2 border-mad-black bg-mad-white">
          <summary className="cursor-pointer list-none px-4 py-3 font-typewriter text-[0.75rem] font-bold tracking-widest uppercase hover:bg-mad-lime/30">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
            Advanced · Automation webhook (Make, n8n, Zapier)
          </summary>
          <div className="border-t-2 border-mad-black p-4">
            <OutboundWebhookCard
              entityId={activeEntity.id}
              brandName={activeEntity.name}
              initialWebhookUrl={outboundChannel?.webhook_url ?? null}
            />
          </div>
        </details>
    </StudioAppShell>
  )
}
