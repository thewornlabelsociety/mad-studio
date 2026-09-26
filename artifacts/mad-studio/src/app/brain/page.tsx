import { cookies, redirect } from "@/lib/next-compat"

import {
  getAccessibleEntities,
  getActiveOrganizationId,
  isCurrentUserOrgAdmin,
} from "@/lib/actions"
import { BrainLab } from "@/components/brain/brain-lab"
import { AppTopbar } from "@/components/layout/app-topbar"
import { TeamInviteModal } from "@/components/team/team-invite-modal"
import type {
  BrainDocument,
  BrainQuote,
  BrainTakeaway,
} from "@/lib/brain/types"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Brain Lab",
}

type BrainPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

export default async function BrainPage({ searchParams }: BrainPageProps) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login?redirect=/brain")
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

  if (params.eid !== activeSummary.id) {
    redirect(`/brain?eid=${encodeURIComponent(activeSummary.id)}`)
  }

  const organizationId =
    activeSummary.organization_id ?? (await getActiveOrganizationId(user.id))
  const isOrgAdmin = organizationId
    ? await isCurrentUserOrgAdmin(organizationId)
    : false

  const { data: entityRow, error: entityError } = await supabase
    .from("entities")
    .select(
      "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
    )
    .eq("id", activeSummary.id)
    .single()

  if (entityError || !entityRow) {
    redirect("/studio?error=" + encodeURIComponent("Could not load brand DNA."))
  }

  const entity = parseStudioEntity(entityRow)

  const [{ data: documents }, { data: quotes }, { data: takeawayRows }] =
    await Promise.all([
      supabase
        .from("entity_documents")
        .select(
          "id, title, file_url, extracted_knowledge, doc_type, created_at"
        )
        .eq("entity_id", entity.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("entity_customer_quotes")
        .select("id, quote_text, source, customer_emotion, created_at")
        .eq("entity_id", entity.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("campaigns")
        .select("id, title, outcome_rating, ai_takeaway, updated_at")
        .eq("entity_id", entity.id)
        .in("outcome_rating", ["winner", "loss"])
        .not("ai_takeaway", "is", null)
        .order("updated_at", { ascending: false }),
    ])

  const takeaways: BrainTakeaway[] = (takeawayRows ?? [])
    .filter((row) => Boolean(row.ai_takeaway))
    .map((row) => ({
      id: row.id,
      title: row.title,
      outcome_rating: row.outcome_rating,
      ai_takeaway: row.ai_takeaway as string,
      updated_at: row.updated_at,
    }))

  return (
    <div className="flex min-h-svh flex-col bg-mad-white">
      <AppTopbar
        entities={entities}
        activeEntityId={entity.id}
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
        <BrainLab
          entity={entity}
          documents={(documents ?? []) as BrainDocument[]}
          quotes={(quotes ?? []) as BrainQuote[]}
          takeaways={takeaways}
        />
      </main>
    </div>
  )
}
