import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getAccessibleEntities } from "@/app/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { ENTITY_COOKIE } from "@/lib/types"

export const metadata = {
  title: "Inventory",
}

type InventoryPageProps = {
  searchParams: Promise<{ eid?: string; entityId?: string }>
}

/** Inventory list retired — intake lives on /today, workbench on /studio. */
export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
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
  const activeEntity =
    entities.find((entity) => entity.id === requestedEntityId) ??
    entities[0] ??
    null

  const qs = new URLSearchParams()
  if (activeEntity) qs.set("eid", activeEntity.id)
  redirect(`/studio${qs.toString() ? `?${qs.toString()}` : ""}`)
}
