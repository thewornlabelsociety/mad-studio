import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { StudioAppShell } from "@/components/layout/studio-app-shell"
import { InventoryLibraryWorkspace } from "@/components/inventory/inventory-library-workspace"
import { PullNewArrivalsButton } from "@/components/inventory/pull-new-arrivals-button"
import {
  resolveInventoryIntakeMode,
} from "@/lib/inventory/entity-intake"
import { resolveIndustryProfile } from "@/lib/brands/industry-templates"
import { resolveVisualPresets } from "@/lib/brands/visual-presets"
import type { BrandIdentity } from "@/lib/entities/dna-schema"
import { mapMarketingEntityRow } from "@/lib/inventory/types"
import { FUDI_ENTITY_ID } from "@/lib/studio/fudi-platform"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Library",
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

  const [{ data: rows }, { data: entityRow }] = await Promise.all([
    supabase
      .from("marketing_entities")
      .select(
        "id, entity_id, website_item_id, title, brand, price, description, images, status, metrics, scheduled_at, channels, copy_draft, published_media_ids, trackable_slug, published_at, created_at, updated_at"
      )
      .eq("entity_id", activeSummary.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("entities")
      .select("website_url, brand_identity")
      .eq("id", activeSummary.id)
      .maybeSingle(),
  ])

  const items = (rows ?? []).map(mapMarketingEntityRow)
  // This brand's own colours, type and logo (from Brand Brain).
  const visualPresets = resolveVisualPresets({
    brandName: activeSummary.name,
    industry: activeSummary.industry,
    brandIdentity: (entityRow?.brand_identity ?? null) as Partial<BrandIdentity> | null,
  })
  const requireSize =
    resolveIndustryProfile({
      name: activeSummary.name,
      industry: activeSummary.industry,
    }).id === "worn_label"
  const isFudi = activeSummary.id === FUDI_ENTITY_ID
  const organizationId =
    activeSummary.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  return (
    <StudioAppShell
      className="bg-mad-white"
      mainClassName="mx-auto w-full max-w-6xl overflow-y-auto px-4 py-8 sm:px-6"
      entities={entities}
      activeEntityId={activeSummary.id}
      userEmail={user.email ?? null}
      isOrgAdmin={isOrgAdmin}
      organizationId={organizationId}
    >
        <header className="mb-6 flex flex-col gap-4 border-b-2 border-mad-black pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
              Products &amp; media
            </p>
            <h1 className="font-typewriter text-2xl font-bold tracking-typewriter-tight text-mad-black uppercase">
              Library // {activeSummary.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-600">
              {isFudi
                ? "Unfeatured drops pulled from the FÜDI app Supabase project — scoped to this brand only."
                : "Get each item ready to post — brand, size and an approved description — then make its story."}
            </p>
          </div>
          <PullNewArrivalsButton
            entityId={activeSummary.id}
            intakeMode={intakeMode}
          />
        </header>
        <InventoryLibraryWorkspace
          entityId={activeSummary.id}
          brandName={activeSummary.name}
          websiteUrl={entityRow?.website_url ?? null}
          industry={activeSummary.industry}
          visualPresets={visualPresets}
          requireSize={requireSize}
          items={items}
        />
    </StudioAppShell>
  )
}
