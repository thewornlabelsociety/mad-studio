import { z } from "zod"

export type PlannerDuration = "3-day" | "5-day" | "1-week"

export const plannerDurationSchema = z.enum(["3-day", "5-day", "1-week"])

export function plannerDurationDayCount(duration: PlannerDuration): number {
  if (duration === "3-day") return 3
  if (duration === "5-day") return 5
  return 7
}

export const plannerTimelineDaySchema = z.object({
  phase: z.string().min(1).max(120),
  hook: z.string().min(1).max(280),
  vibe: z.string().min(1).max(400),
  directorialAction: z.string().min(1).max(400),
})

export const plannerTimelineResponseSchema = z.object({
  days: z.array(plannerTimelineDaySchema).min(1).max(7),
})

export const generateCampaignRequestSchema = z.object({
  entityId: z.string().uuid(),
  prompt: z.string().min(8).max(2000),
  duration: plannerDurationSchema,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
})

export type PlannerTimelineDayPayload = z.infer<typeof plannerTimelineDaySchema>

export type PlannerTimelineDay = PlannerTimelineDayPayload & {
  id: string
  date: Date
}

export type PlannerTimelineApiDay = PlannerTimelineDayPayload & {
  date: string
}
