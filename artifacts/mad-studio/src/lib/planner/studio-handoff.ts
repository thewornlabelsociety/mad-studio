export type StudioPlannerHandoff = {
  phase: string
  hook: string
  vibe: string
  directorialAction: string
  scheduledDate?: string
}

export function studioPlannerHandoffStorageKey(entityId: string): string {
  return `studio-planner-handoff:${entityId}`
}

/** Seeds Studio Intent spark + headline from a planner day card. */
export function buildPlannerStudioSpark(handoff: StudioPlannerHandoff): string {
  const parts = [
    handoff.hook.trim(),
    handoff.vibe.trim() ? `Vibe: ${handoff.vibe.trim()}` : "",
    handoff.directorialAction.trim()
      ? `Directorial cue: ${handoff.directorialAction.trim()}`
      : "",
    handoff.phase.trim() ? `Phase: ${handoff.phase.trim()}` : "",
  ].filter(Boolean)
  return parts.join("\n\n").slice(0, 500)
}

export function writeStudioPlannerHandoff(
  entityId: string,
  handoff: StudioPlannerHandoff
): void {
  try {
    sessionStorage.setItem(
      studioPlannerHandoffStorageKey(entityId),
      JSON.stringify(handoff)
    )
  } catch {
    // sessionStorage unavailable — URL prompt fallback still works
  }
}

export function readStudioPlannerHandoff(
  entityId: string
): StudioPlannerHandoff | null {
  try {
    const raw = sessionStorage.getItem(studioPlannerHandoffStorageKey(entityId))
    if (!raw) return null
    sessionStorage.removeItem(studioPlannerHandoffStorageKey(entityId))
    const parsed = JSON.parse(raw) as StudioPlannerHandoff
    if (!parsed?.hook?.trim()) return null
    return parsed
  } catch {
    return null
  }
}
