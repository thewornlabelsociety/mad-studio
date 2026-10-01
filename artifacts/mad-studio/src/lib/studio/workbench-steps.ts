/** Step 1 lives on `/today`; Studio workbench uses steps 2–6 (five studio screens). */
export const WORKBENCH_STEP_TODAY = 1 as const
export const WORKBENCH_STEP_MEDIA = 2 as const
export const WORKBENCH_STEP_INTENT = 3 as const
export const WORKBENCH_STEP_CANVAS = 4 as const
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
  { id: WORKBENCH_STEP_MEDIA, label: "Media" },
  { id: WORKBENCH_STEP_INTENT, label: "Intent" },
  { id: WORKBENCH_STEP_CANVAS, label: "Canvas" },
  { id: WORKBENCH_STEP_COPY, label: "Copy" },
  { id: WORKBENCH_STEP_CHANNELS, label: "Schedule" },
] as const

export function clampWorkbenchStep(value: number): WorkbenchFlowStep {
  if (value <= 1) return WORKBENCH_STEP_TODAY
  if (value === 2) return WORKBENCH_STEP_MEDIA
  if (value === 3) return WORKBENCH_STEP_INTENT
  if (value === 4) return WORKBENCH_STEP_CANVAS
  if (value === 5) return WORKBENCH_STEP_COPY
  return WORKBENCH_STEP_CHANNELS
}

export function parseWorkbenchStepParam(
  raw: string | null | undefined
): WorkbenchFlowStep {
  const n = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(n)) return WORKBENCH_STEP_MEDIA
  // Legacy URLs: step 3 = old monolithic Customize → Copy; step 4 = old Channels
  if (n === 3) return WORKBENCH_STEP_COPY
  if (n === 4) return WORKBENCH_STEP_CHANNELS
  return clampWorkbenchStep(n)
}

export function nextWorkbenchStep(step: WorkbenchFlowStep): WorkbenchFlowStep {
  if (step === WORKBENCH_STEP_MEDIA) return WORKBENCH_STEP_INTENT
  if (step === WORKBENCH_STEP_INTENT) return WORKBENCH_STEP_CANVAS
  if (step === WORKBENCH_STEP_CANVAS) return WORKBENCH_STEP_COPY
  if (step === WORKBENCH_STEP_COPY) return WORKBENCH_STEP_CHANNELS
  return step
}

export function prevWorkbenchStep(step: WorkbenchFlowStep): WorkbenchFlowStep {
  if (step === WORKBENCH_STEP_CHANNELS) return WORKBENCH_STEP_COPY
  if (step === WORKBENCH_STEP_COPY) return WORKBENCH_STEP_CANVAS
  if (step === WORKBENCH_STEP_CANVAS) return WORKBENCH_STEP_INTENT
  if (step === WORKBENCH_STEP_INTENT) return WORKBENCH_STEP_MEDIA
  return step
}
