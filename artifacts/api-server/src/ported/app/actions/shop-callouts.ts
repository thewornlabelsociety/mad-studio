"use server"

import { assertBrainEntityAccess } from "@/lib/brain/entity-access"
import { fetchShopCallouts, type ShopCallout } from "@/lib/shop/shop-callouts"
import { createClient } from "@/lib/supabase/server"
import { isWornLabelFashionEntity } from "@/lib/templates/wls-daily-story"

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

/** "Wanted" call-outs the shop has emailed and shared for socials, newest first. Worn Label only. */
export async function getShopCallouts(entityId: string): Promise<ActionResult<{ callouts: ShopCallout[] }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "You must be signed in." }

  const access = await assertBrainEntityAccess({ supabase, userId: user.id, entityId, mode: "view" })
  if (!access.ok) return { ok: false, error: access.error }

  const { data: entity } = await supabase.from("entities").select("name, industry").eq("id", entityId).maybeSingle()
  if (!entity || !isWornLabelFashionEntity({ name: entity.name, industry: entity.industry })) {
    return { ok: true, data: { callouts: [] } }
  }

  const result = await fetchShopCallouts()
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, data: { callouts: result.callouts } }
}
