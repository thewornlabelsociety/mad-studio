/** Stable key for “same template handoff already applied for this entity”. */
export function studioTemplateHandoffResumeKey(input: {
  entityId: string
  templateInstanceId: string
  templateVersion: string | null | undefined
}): string {
  const version =
    input.templateVersion != null && String(input.templateVersion).trim() !== ""
      ? String(input.templateVersion).trim()
      : ""
  return `${input.entityId}:${input.templateInstanceId}:${version}`
}

/**
 * Skip a duplicate POST handoff when the tray already has media for the same
 * entity + template instance + URL template version (Today re-entry).
 */
export function shouldSkipStudioTemplateHandoff(input: {
  mediaAssetCount: number
  resumeKey: string
  lastSuccessfulHandoffKey: string | null
}): boolean {
  if (input.mediaAssetCount <= 0) return false
  if (!input.lastSuccessfulHandoffKey) return false
  return input.lastSuccessfulHandoffKey === input.resumeKey
}
