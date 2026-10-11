import type { Json } from "@/lib/database.types"
import { parseStudioEntity } from "@/lib/campaigns/entity-dna"
import {
  DEFAULT_FORMULA_BANK,
  resolveFormulaBank,
  type FormulaHookStyle,
} from "@/lib/studio/formula-bank"
import type { SupabaseClient } from "@supabase/supabase-js"

type HookWithStats = FormulaHookStyle & {
  weight?: number
  success_count?: number
  failure_count?: number
}

function normalizeHook(row: HookWithStats): HookWithStats {
  return {
    ...row,
    weight: typeof row.weight === "number" && row.weight > 0 ? row.weight : 1,
    success_count:
      typeof row.success_count === "number" && row.success_count >= 0
        ? row.success_count
        : 0,
    failure_count:
      typeof row.failure_count === "number" && row.failure_count >= 0
        ? row.failure_count
        : 0,
  }
}

export async function adjustFormulaWeight(input: {
  supabase: SupabaseClient
  entityId: string
  formulaId: string
  outcome: "win" | "loss"
}): Promise<void> {
  const { data: entityRow, error } = await input.supabase
    .from("entities")
    .select(
      "id, name, industry, organization_id, website_url, brand_identity, audience_segments, value_propositions, conversion_goals, content_pillars, local_context"
    )
    .eq("id", input.entityId)
    .maybeSingle()

  if (error || !entityRow) return

  const entity = parseStudioEntity(entityRow)

  const bank = resolveFormulaBank(entity.brand_identity)
  let changed = false

  const hook_styles = bank.hook_styles.map((row) => {
    const hook = normalizeHook(row as HookWithStats)
    if (hook.id !== input.formulaId) return hook
    changed = true
    if (input.outcome === "win") {
      return {
        ...hook,
        success_count: (hook.success_count ?? 0) + 1,
        weight: Math.min(3, (hook.weight ?? 1) * 1.15),
      }
    }
    return {
      ...hook,
      failure_count: (hook.failure_count ?? 0) + 1,
      weight: Math.max(0.35, (hook.weight ?? 1) * 0.85),
    }
  })

  if (!changed) return

  const nextIdentity = {
    ...(entity.brand_identity ?? {}),
    formula_bank: {
      hook_styles,
      visual_directions:
        bank.visual_directions.length > 0
          ? bank.visual_directions
          : DEFAULT_FORMULA_BANK.visual_directions,
    },
  }

  await input.supabase
    .from("entities")
    .update({ brand_identity: nextIdentity as Json })
    .eq("id", input.entityId)
}
