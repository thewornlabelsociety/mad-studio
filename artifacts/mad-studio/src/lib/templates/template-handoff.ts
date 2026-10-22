import type { EntityTemplateInstance } from "./template-schema.ts"

/** Studio handoff URL — reuses existing Create wizard (not a second engine). */
export function buildStudioHandoffHref(input: {
  entityId: string
  template: EntityTemplateInstance
}): string {
  const spark =
    input.template.creative_instructions.trim() ||
    input.template.payload.creative_instructions.trim() ||
    input.template.name
  const params = new URLSearchParams({
    eid: input.entityId,
    step: "2",
    prompt: spark.slice(0, 500),
    templateInstanceId: input.template.id,
    templateVersion: String(input.template.version),
  })
  if (input.template.formula_hook_id) {
    params.set("formulaHookId", input.template.formula_hook_id)
  }
  return `/studio?${params.toString()}`
}

export function categoryLabel(category: string): string {
  return category.replace(/_/g, " ")
}
