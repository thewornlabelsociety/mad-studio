export const SCHEDULER_CHANNELS = [
  "instagram_story",
  "tiktok",
  "facebook",
  "email",
] as const

export type SchedulerChannel = (typeof SCHEDULER_CHANNELS)[number]

/** Platforms accepted by `public.scheduled_posts.platform`. */
export const QUEUE_PLATFORMS = [
  "instagram_story",
  "instagram_feed",
  "facebook",
  "tiktok",
  "email",
] as const

export type QueuePlatform = (typeof QUEUE_PLATFORMS)[number]

export type DispatchMode = "immediate" | "scheduled"
export type TimingSource = "brain" | "manual" | "immediate"

export type ChannelSlot = {
  channel: SchedulerChannel
  enabled: boolean
  mode: DispatchMode
  /** ISO timestamp. */
  scheduledAt: string
  timingSource: TimingSource
  demographicTag: string
}

export const CHANNEL_META: Record<
  SchedulerChannel,
  { label: string; short: string; dispatchChannel: string }
> = {
  instagram_story: {
    label: "Instagram Story",
    short: "Instagram",
    dispatchChannel: "instagram_story",
  },
  tiktok: { label: "TikTok Reel", short: "TikTok", dispatchChannel: "tiktok" },
  facebook: {
    label: "Facebook Page",
    short: "Facebook",
    dispatchChannel: "facebook",
  },
  email: {
    label: "VIP Email",
    short: "VIP Email",
    dispatchChannel: "email_newsletter",
  },
}

type TargetWindow = {
  hour: number
  minute: number
  /** 0 = Sunday … 6 = Saturday. Omit for every day. */
  weekdays?: number[]
  tag: string
}

const TARGET_WINDOWS: Record<SchedulerChannel, TargetWindow[]> = {
  instagram_story: [
    { hour: 12, minute: 30, tag: "Lunch Break Scroll" },
    { hour: 17, minute: 30, tag: "Commute Wind-Down" },
  ],
  tiktok: [{ hour: 20, minute: 15, tag: "Night Leisure Discovery" }],
  facebook: [{ hour: 7, minute: 30, tag: "Morning Feed Check-In" }],
  email: [
    { hour: 10, minute: 0, weekdays: [2, 4], tag: "Midweek Inbox Priority" },
  ],
}

/** Minimum lead time so a Brain slot is never "right now". */
const MIN_LEAD_MS = 10 * 60 * 1000

export function demographicTagFor(channel: SchedulerChannel, at?: Date): string {
  const windows = TARGET_WINDOWS[channel]
  if (at) {
    const match = windows.find(
      (row) => row.hour === at.getHours() && row.minute === at.getMinutes()
    )
    if (match) return `${CHANNEL_META[channel].short}: ${match.tag}`
  }
  if (channel === "instagram_story" && at) {
    return `${CHANNEL_META[channel].short}: ${
      at.getHours() < 15 ? windows[0].tag : windows[1].tag
    }`
  }
  return `${CHANNEL_META[channel].short}: ${windows[0].tag}`
}

/** Next demographic target window for a channel, in the caller's local time. */
export function nextOptimalSlot(
  channel: SchedulerChannel,
  now: Date = new Date()
): { at: Date; tag: string } {
  const earliest = now.getTime() + MIN_LEAD_MS
  const windows = TARGET_WINDOWS[channel]

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + dayOffset)
    const candidates = windows
      .filter((row) => !row.weekdays || row.weekdays.includes(day.getDay()))
      .map((row) => {
        const at = new Date(day)
        at.setHours(row.hour, row.minute, 0, 0)
        return { at, tag: row.tag }
      })
      .filter((row) => row.at.getTime() >= earliest)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
    if (candidates[0]) {
      return {
        at: candidates[0].at,
        tag: `${CHANNEL_META[channel].short}: ${candidates[0].tag}`,
      }
    }
  }

  const fallback = new Date(earliest)
  return { at: fallback, tag: demographicTagFor(channel) }
}

export function buildBrainPlan(
  channels: readonly SchedulerChannel[] = SCHEDULER_CHANNELS,
  now: Date = new Date()
): ChannelSlot[] {
  return channels.map((channel) => {
    const slot = nextOptimalSlot(channel, now)
    return {
      channel,
      enabled: true,
      mode: "scheduled",
      scheduledAt: slot.at.toISOString(),
      timingSource: "brain",
      demographicTag: slot.tag,
    }
  })
}

export function applyBrainTiming(
  plan: ChannelSlot[],
  now: Date = new Date()
): ChannelSlot[] {
  return plan.map((slot) => {
    if (!slot.enabled) return slot
    const next = nextOptimalSlot(slot.channel, now)
    return {
      ...slot,
      mode: "scheduled",
      scheduledAt: next.at.toISOString(),
      timingSource: "brain",
      demographicTag: next.tag,
    }
  })
}

const LEGACY_CHANNEL_MAP: Record<string, SchedulerChannel> = {
  instagram_story: "instagram_story",
  instagram_feed: "instagram_story",
  instagram: "instagram_story",
  tiktok: "tiktok",
  facebook: "facebook",
  email: "email",
  email_newsletter: "email",
}

function isSchedulerChannel(value: unknown): value is SchedulerChannel {
  return (
    typeof value === "string" &&
    (SCHEDULER_CHANNELS as readonly string[]).includes(value)
  )
}

/**
 * Restores a saved plan (copy_draft.dispatch_plan) or seeds a fresh Brain plan,
 * enabling channels previously selected on the item.
 */
export function hydrateDispatchPlan(input: {
  saved?: unknown
  legacyChannels?: string[]
  now?: Date
}): ChannelSlot[] {
  const now = input.now ?? new Date()
  const fresh = buildBrainPlan(SCHEDULER_CHANNELS, now)

  if (Array.isArray(input.saved) && input.saved.length > 0) {
    const byChannel = new Map<SchedulerChannel, Partial<ChannelSlot>>()
    for (const raw of input.saved) {
      if (!raw || typeof raw !== "object") continue
      const row = raw as Partial<ChannelSlot>
      if (isSchedulerChannel(row.channel)) byChannel.set(row.channel, row)
    }
    return fresh.map((slot) => {
      const saved = byChannel.get(slot.channel)
      if (!saved) return { ...slot, enabled: false }
      const savedAt =
        typeof saved.scheduledAt === "string"
          ? Date.parse(saved.scheduledAt)
          : NaN
      const stale = !Number.isFinite(savedAt) || savedAt < now.getTime()
      return {
        ...slot,
        enabled: saved.enabled !== false,
        mode: saved.mode === "immediate" ? "immediate" : "scheduled",
        ...(stale || saved.timingSource === "brain"
          ? {}
          : {
              scheduledAt: new Date(savedAt).toISOString(),
              timingSource: "manual" as const,
              demographicTag:
                typeof saved.demographicTag === "string"
                  ? saved.demographicTag
                  : slot.demographicTag,
            }),
      }
    })
  }

  const legacy = new Set(
    (input.legacyChannels ?? [])
      .map((row) => LEGACY_CHANNEL_MAP[row])
      .filter(Boolean)
  )
  if (legacy.size === 0) return fresh
  return fresh.map((slot) => ({ ...slot, enabled: legacy.has(slot.channel) }))
}

export function toQueuePlatform(channel: SchedulerChannel): QueuePlatform {
  return channel
}

/** `YYYY-MM-DDTHH:mm` in local time for `<input type="datetime-local">`. */
export function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function formatSlotLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
  if (diffDays === 0) return `Today ${time}`
  if (diffDays === 1) return `Tomorrow ${time}`
  return `${date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} ${time}`
}
