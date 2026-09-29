import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { AppTopbar } from "@/components/layout/app-topbar"
import { InventoryList } from "@/components/inventory/inventory-list"
import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import {
  resolveInventoryIntakeMode,
} from "@/lib/inventory/entity-intake"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Inventory",
}

type InventoryPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/inventory")
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

  const intakeMode = resolveInventoryIntakeMode({
    name: activeSummary.name,
    industry: activeSummary.industry,
  })

  const { data: rows } = await supabase
    .from("marketing_entities")
    .select(
      "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
    )
    .eq("entity_id", activeSummary.id)
    .order("created_at", { ascending: false })
    .limit(200)

  const items = (rows ?? []).map(mapMarketingEntityRow)
  const isFudi = activeSummary.id === FUDI_ENTITY_ID
  const organizationId =
    activeSummary.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  return (
    <div className="flex min-h-svh flex-col bg-mad-white">
      <AppTopbar
        entities={entities}
        activeEntityId={activeSummary.id}
        userEmail={user.email ?? null}
        isOrgAdmin={isOrgAdmin}
        organizationId={organizationId}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-col gap-4 border-b-2 border-mad-black pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Intake ledger
            </p>
            <h1 className="font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase">
              Inventory // {activeSummary.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-600">
              {isFudi
                ? "Unfeatured drops pulled from the FÜDI app Supabase project — scoped to this brand only."
                : "Marketing inventory for the active brand. Switch entities in the top bar to avoid cross-tenant leakage."}
            </p>
          </div>
          <PullNewArrivalsButton
            entityId={activeSummary.id}
            intakeMode={intakeMode}
          />
        </header>
        <InventoryList entityId={activeSummary.id} items={items} />
      </main>
    </div>
  )
}
