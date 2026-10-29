/**
 * Step 1 lives on `/today`. Create rail is Pick → Make → Post: Media, Canvas,
 * then Copy (who it's for + caption) running on into Schedule (channels and
 * times). Intent is folded into Copy; `?step=4` lands on Copy.
 */
export const WORKBENCH_STEP_TODAY = 1 as const
export const WORKBENCH_STEP_MEDIA = 2 as const
/** On-image polish — Create rail position 2 (after Media). */
export const WORKBENCH_STEP_CANVAS = 3 as const
/** Audience, focus, pillar — Create rail position 3 (after Canvas). */
export const WORKBENCH_STEP_INTENT = 4 as const
export const WORKBENCH_STEP_COPY = 5 as const
export const WORKBENCH_STEP_CHANNELS = 6 as const

/** @deprecated Use WORKBENCH_STEP_COPY — kept for imports / URL compat. */
export const WORKBENCH_STEP_CUSTOMIZE = WORKBENCH_STEP_COPY

export type WorkbenchFlowStep =
  | typeof WORKBENCH_STEP_TODAY
  | typeof WORKBENCH_STEP_MEDIA
  | typeof WORKBENCH_STEP_INTENT
  | typeof WORKBENCH_STEP_CANVAS
  | typeof WORKBENCH_STEP_COPY
  | typeof WORKBENCH_STEP_CHANNELS

export const STUDIO_WIZARD_STEPS = [
  { id: WORKBENCH_STEP_MEDIA, label: "Pick" },
  { id: WORKBENCH_STEP_CANVAS, label: "Make" },
  { id: WORKBENCH_STEP_COPY, label: "Post" },
] as const

/** The rail step to light up: Schedule is the end of Post. */
export function wizardRailStep(step: WorkbenchFlowStep): WorkbenchFlowStep {
  if (step === WORKBENCH_STEP_CHANNELS || step === WORKBENCH_STEP_INTENT) {
    return WORKBENCH_STEP_COPY
  }
  return step
}

export function clampWorkbenchStep(value: number): WorkbenchFlowStep {
  if (value <= 1) return WORKBENCH_STEP_TODAY
  if (value === 2) return WORKBENCH_STEP_MEDIA
  if (value === 3) return WORKBENCH_STEP_CANVAS
  if (value === 4 || value === 5) return WORKBENCH_STEP_COPY
  return WORKBENCH_STEP_CHANNELS
}

export function parseWorkbenchStepParam(
  raw: string | null | undefined
): WorkbenchFlowStep {
  const n = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(n)) return WORKBENCH_STEP_MEDIA
  return clampWorkbenchStep(n)
}

export function nextWorkbenchStep(step: WorkbenchFlowStep): WorkbenchFlowStep {
  if (step === WORKBENCH_STEP_MEDIA) return WORKBENCH_STEP_CANVAS
  if (step === WORKBENCH_STEP_CANVAS || step === WORKBENCH_STEP_INTENT) {
    return WORKBENCH_STEP_COPY
  }
  if (step === WORKBENCH_STEP_COPY) return WORKBENCH_STEP_CHANNELS
  return step
}

export function prevWorkbenchStep(step: WorkbenchFlowStep): WorkbenchFlowStep {
  if (step === WORKBENCH_STEP_CHANNELS) return WORKBENCH_STEP_COPY
  if (step === WORKBENCH_STEP_COPY || step === WORKBENCH_STEP_INTENT) {
    return WORKBENCH_STEP_CANVAS
  }
  if (step === WORKBENCH_STEP_CANVAS) return WORKBENCH_STEP_MEDIA
  return step
}
