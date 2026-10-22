import type { CampaignTemplateAttribution } from "./template-schema.ts"
import {
  buildCampaignAttribution,
  buildTemplateGenerationKey,
  isDuplicateGenerationError,
} from "./template-engine.ts"

/**
 * Optional attribution payload for campaign inserts.
 * Phase 3B: columns exist; generation/publishing paths remain unchanged unless
 * callers explicitly pass these fields (all nullable).
 */
export function buildOptionalCampaignTemplateFields(input: {
  entityId: string
  templateInstanceId: string
  templateVersionId: string
  requestFingerprint: string
}): {
  attribution: CampaignTemplateAttribution
  generationKey: string
  columns: {
    template_instance_id: string
    template_version_id: string
    template_generation_key: string
  }
} {
  const generationKey = buildTemplateGenerationKey({
    entityId: input.entityId,
    templateInstanceId: input.templateInstanceId,
    templateVersionId: input.templateVersionId,
    requestFingerprint: input.requestFingerprint,
  })
  const attribution = buildCampaignAttribution({
    templateInstanceId: input.templateInstanceId,
    templateVersionId: input.templateVersionId,
    generationKey,
  })
  return {
    attribution,
    generationKey,
    columns: {
      template_instance_id: input.templateInstanceId,
      template_version_id: input.templateVersionId,
      template_generation_key: generationKey,
    },
  }
}

export { isDuplicateGenerationError }
