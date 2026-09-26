import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"

import {
  claimFirstOrgAdmin,
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/app/actions/auth"
import { InventoryItemDetail } from "@/components/inventory/inventory-item-detail"
import { AppTopbar } from "@/components/layout/app-topbar"
import { StudioWorkspace } from "@/components/studio/studio-workspace"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import { Button } from "@/components/ui/button"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  mapMarketingEntityRow,
  type ScheduledSlotOccupancy,
} from "@/lib/inventory/types"
import { createClient } from "@/lib/supabase/server"
import { ENTITY_COOKIE } from "@/lib/types"

type StudioPageProps = {
  searchParams: Promise<{
    eid?: string
    entityId?: string
    pack_id?: string
    itemId?: string
    prompt?: string
    error?: string
  }>
}

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/studio")
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const cookieEntityId = cookieStore.get(ENTITY_COOKIE)?.value ?? null
  const requestedEntityId = params.eid ?? params.entityId ?? cookieEntityId
  const activeSummary =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  if (activeSummary && params.eid !== activeSummary.id) {
    const qs = new URLSearchParams()
    qs.set("eid", activeSummary.id)
    if (params.pack_id) qs.set("pack_id", params.pack_id)
    if (params.itemId) qs.set("itemId", params.itemId)
    redirect(`/studio?${qs.toString()}`)
  }

  const organizationId =
    activeSummary?.organization_id ??
    (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  let activeEntity = null
  if (activeSummary) {
    const { data: entityRow } = await supabase
      .from("entities")
      .select(
        "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
      )
      .eq("id", activeSummary.id)
      .single()

    if (entityRow) {
      activeEntity = parseStudioEntity(entityRow)
    }
  }

  const itemId = params.itemId?.trim() || null
  let dropItem = null
  let occupiedSlots: ScheduledSlotOccupancy[] = []
  let websiteUrl: string | null = null
  let visualPresets: {
    canvas_color: string
    accent_color: string
    text_color: string
    font_family: string
  } | null = null

  if (itemId && activeSummary) {
    const { data: row } = await supabase
      .from("marketing_entities")
      .select(
        "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
      )
      .eq("id", itemId)
      .eq("entity_id", activeSummary.id)
      .maybeSingle()

    if (row) {
      dropItem = mapMarketingEntityRow(row)

      const { data: entityMeta } = await supabase
        .from("entities")
        .select("website_url, brand_identity")
        .eq("id", activeSummary.id)
        .maybeSingle()

      websiteUrl = entityMeta?.website_url ?? null
      visualPresets =
        entityMeta?.brand_identity &&
        typeof entityMeta.brand_identity === "object" &&
        !Array.isArray(entityMeta.brand_identity) &&
        "visual_presets" in entityMeta.brand_identity
          ? ((entityMeta.brand_identity as { visual_presets?: unknown })
              .visual_presets as typeof visualPresets) ?? null
          : null

      const windowStart = new Date()
      windowStart.setHours(0, 0, 0, 0)
      const windowEnd = new Date(windowStart)
      windowEnd.setDate(windowEnd.getDate() + 8)

      const { data: scheduledRows } = await supabase
        .from("marketing_entities")
        .select("id, title, scheduled_at, channels")
        .eq("entity_id", activeSummary.id)
        .in("status", ["scheduled", "published"])
        .not("scheduled_at", "is", null)
        .gte("scheduled_at", windowStart.toISOString())
        .lt("scheduled_at", windowEnd.toISOString())

      occupiedSlots = (scheduledRows ?? [])
        .filter((entry) => Boolean(entry.scheduled_at))
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          scheduled_at: entry.scheduled_at as string,
          channels: Array.isArray(entry.channels) ? entry.channels : [],
        }))
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-mad-white">
      <AppTopbar
        entities={entities}
        activeEntityId={activeSummary?.id ?? null}
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4">
        {dropItem && activeSummary ? null : (
          <section className="flex flex-wrap items-end justify-between gap-3 border-b border-mad-black/20 pb-3">
            <div className="space-y-1">
              <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
                Campaign Multiplexer
              </p>
              <h1 className="brand-typewriter text-lg text-mad-black sm:text-xl">
                {activeEntity?.name ?? "No brand selected"}
              </h1>
              <p className="max-w-xl text-sm text-neutral-600">
                {activeEntity
                  ? "Scratch pack: media → spark → five assets."
                  : "Accept an invitation or claim org admin to unlock the studio."}
              </p>
              {params.error ? (
                <p
                  className="border-2 border-mad-black bg-mad-vermillion px-3 py-2 text-sm font-bold text-mad-white"
                  role="alert"
                >
                  {params.error}
                </p>
              ) : null}
            </div>
            <form action="/api/auth/signout" method="post">
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="rounded-none border border-mad-black/40 font-typewriter text-[0.6rem] uppercase"
              >
                Sign out
              </Button>
            </form>
          </section>
        )}

        {params.error && dropItem ? (
          <p
            className="border-2 border-mad-black bg-mad-vermillion px-3 py-2 text-sm font-bold text-mad-white"
            role="alert"
          >
            {params.error}
          </p>
        ) : null}

        {entities.length === 0 ? (
          <section className="max-w-lg border-2 border-mad-black bg-mad-white p-5 shadow-keycap">
            <h2 className="font-typewriter text-sm font-bold tracking-widest uppercase">
              Bootstrap access
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              If this workspace has no members yet, claim org admin to manage
              invites and create brands.
            </p>
            <form action={claimFirstOrgAdmin} className="mt-4">
              <Button
                type="submit"
                size="sm"
                className="rounded-none border-2 border-mad-black bg-mad-black font-typewriter text-[0.65rem] uppercase"
              >
                Claim first org admin
              </Button>
            </form>
          </section>
        ) : dropItem && activeSummary ? (
          <InventoryItemDetail
            item={dropItem}
            brandName={activeSummary.name}
            industry={activeSummary.industry}
            entityId={activeSummary.id}
            websiteUrl={websiteUrl}
            visualPresets={visualPresets}
            occupiedSlots={occupiedSlots}
          />
        ) : activeEntity ? (
          <Suspense
            fallback={
              <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-neutral-500 uppercase">
                Loading studio…
              </p>
            }
          >
            <StudioWorkspace
              key={activeEntity.id}
              entities={entities}
              activeEntity={activeEntity}
            />
          </Suspense>
        ) : (
          <p className="border-2 border-mad-black bg-mad-vermillion px-4 py-3 text-sm font-bold text-mad-white">
            MULTI-BRAND ISOLATION ACTIVE. Could not load brand DNA.
          </p>
        )}
      </main>
    </div>
  )
}
