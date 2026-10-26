/** Copy-step text when a template is applied in Create Studio. */
export function resolveTemplateStudioCaption(input: {
  defaultStudioCaption?: string | null
  creativeInstructions?: string | null
  templateName: string
}): string {
  const cta = input.defaultStudioCaption?.trim()
  if (cta) return cta
  return (
    input.creativeInstructions?.trim() || input.templateName.trim() || ""
  )
}
