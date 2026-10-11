import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import { resolveFormulaBank } from "@/lib/studio/formula-bank"

export function inferFormulaIdForHook(
  entity: StudioEntityDna,
  hook: string,
  modelFormulaId?: string | null
): string | null {
  const bank = resolveFormulaBank(entity.brand_identity)
  const normalizedModel = modelFormulaId?.trim()
  if (
    normalizedModel &&
    bank.hook_styles.some((row) => row.id === normalizedModel)
  ) {
    return normalizedModel
  }

  const hookLower = hook.toLowerCase()
  for (const row of bank.hook_styles) {
    const label = row.label.toLowerCase()
    const id = row.id.toLowerCase()
    if (hookLower.includes(label.slice(0, 12)) || hookLower.includes(id.replace(/_/g, " "))) {
      return row.id
    }
  }

  return bank.hook_styles[0]?.id ?? null
}
