import { cookies, redirect } from "@/lib/next-compat"

import { getAccessibleEntities } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Inventory Item",
}

type InventoryItemPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

/** Inventory detail retired — open the drop in Studio instead. */
export default async function InventoryItemPage({
  params,
  searchParams,
}: InventoryItemPageProps) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirect=/studio?itemId=${encodeURIComponent(id)}`)
  }

  const entities = await getAccessibleEntities(user.id)
  const cookieStore = await cookies()
  const cookieEntityId = cookieStore.get(ENTITY_COOKIE)?.value ?? null
  const requestedEntityId = query.eid ?? query.entityId ?? cookieEntityId
  const activeEntity =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  const qs = new URLSearchParams()
  if (activeEntity) qs.set("eid", activeEntity.id)
  qs.set("itemId", id)
  redirect(`/studio?${qs.toString()}`)
}
