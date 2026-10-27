/**
 * Copy-step / Feed caption when a template is applied in Create.
 * Never use creative_instructions here — that field is an operator/AI brief, not public copy.
 */
export function resolveTemplateStudioCaption(input: {
  defaultStudioCaption?: string | null
  /** Ignored for public caption — kept for call-site compatibility. */
  creativeInstructions?: string | null
  templateName: string
}): string {
  const cta = input.defaultStudioCaption?.trim()
  if (cta) return cta
  // Prefer empty so intake / listing captions can fill Copy after handoff.
  void input.creativeInstructions
  void input.templateName
  return ""
}
