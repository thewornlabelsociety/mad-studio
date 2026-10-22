import {
  buildTemplateGenerationKey,
  isDuplicateGenerationError,
} from "./template-engine.ts"

export type ResolvedTemplateForGeneration = {
  instanceId: string
  versionId: string
  version: number
  entityId: string
  name: string
  creativeInstructions: string
  formulaHookId: string | null
  channelPlan: string[]
  placeholderDefaults: Record<string, string>
  canvasLayoutId: string | null
  storyStylePreset: string | null
  packBias: string | null
  surfaces: string[]
  placeholders: string[]
}

/** Pure prompt block — must mention creative rules so generation can change. */
export function buildTemplateGuidancePromptBlock(
  template: ResolvedTemplateForGeneration
): string {
  const placeholderLines =
    Object.keys(template.placeholderDefaults).length > 0
      ? Object.entries(template.placeholderDefaults)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join("\n")
      : template.placeholders.length > 0
        ? template.placeholders
            .map((key) => `- ${key}: (fill from listing/spark)`)
            .join("\n")
        : "- (none)"

  return [
    `## Brand template (mandatory creative brief)`,
    `Template: ${template.name} (instance ${template.instanceId}, version ${template.version})`,
    `Creative instructions (follow closely):`,
    template.creativeInstructions || "(none provided)",
    `Preferred surfaces: ${template.surfaces.join(", ") || "social_post"}`,
    `Channel plan: ${template.channelPlan.join(", ") || "(brand default)"}`,
    template.formulaHookId
      ? `Preferred formula hook id: ${template.formulaHookId}`
      : null,
    template.canvasLayoutId
      ? `Preferred canvas layout id: ${template.canvasLayoutId}`
      : null,
    template.storyStylePreset
      ? `Story style preset: ${template.storyStylePreset}`
      : null,
    template.packBias ? `Pack bias: ${template.packBias}` : null,
    `Placeholder defaults:`,
    placeholderLines,
    `Still obey brand DNA, forbidden words, and client voice. Do not invent offers.`,
  ]
    .filter(Boolean)
    .join("\n")
}

export function buildGenerationRequestFingerprint(input: {
  eventDescription: string
  targetGoal: string
  intent?: string | null
  personaName?: string | null
}): string {
  return [
    input.eventDescription.trim().toLowerCase(),
    input.targetGoal.trim().toLowerCase(),
    (input.intent ?? "").trim().toLowerCase(),
    (input.personaName ?? "").trim().toLowerCase(),
  ].join("|")
}

export function buildAttributionColumns(
  template: ResolvedTemplateForGeneration,
  generationKey: string
) {
  return {
    template_instance_id: template.instanceId,
    template_version_id: template.versionId,
    template_generation_key: generationKey,
  }
}

export function makeGenerationKeyForTemplate(input: {
  entityId: string
  template: ResolvedTemplateForGeneration
  eventDescription: string
  targetGoal: string
  intent?: string | null
  personaName?: string | null
}): string {
  return buildTemplateGenerationKey({
    entityId: input.entityId,
    templateInstanceId: input.template.instanceId,
    templateVersionId: input.template.versionId,
    requestFingerprint: buildGenerationRequestFingerprint({
      eventDescription: input.eventDescription,
      targetGoal: input.targetGoal,
      intent: input.intent,
      personaName: input.personaName,
    }),
  })
}

export { isDuplicateGenerationError }
