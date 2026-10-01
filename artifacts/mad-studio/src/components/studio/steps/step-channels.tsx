"use client"

import { MultiChannelScheduler } from "@/components/marketing/multi-channel-scheduler"
import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"
import {
  CHANNEL_META,
  type ChannelSlot,
  type SchedulerChannel,
} from "@/lib/scheduling/brain-timing"
import type { ScheduledSlotOccupancy } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

const CHANNEL_BUTTONS: Array<{
  channel: SchedulerChannel
  platform: SimulatorPlatform
  label: string
}> = [
  {
    channel: "instagram_story",
    platform: "ig_story",
    label: "Instagram Story",
  },
  {
    channel: "instagram_feed",
    platform: "ig_feed",
    label: "Instagram Feed",
  },
  { channel: "facebook", platform: "facebook", label: "Facebook Page" },
  { channel: "tiktok", platform: "tiktok", label: "TikTok" },
]

type Props = {
  plan: ChannelSlot[] | null
  onPlanChange: (plan: ChannelSlot[]) => void
  occupied: ScheduledSlotOccupancy[]
  activePlatform: SimulatorPlatform
  onPlatformChange: (platform: SimulatorPlatform) => void
  onSaveDraft: () => void
  onArm: () => void
  saving: boolean
  arming: boolean
  locked?: boolean
  hideFooterActions?: boolean
}

export function StepChannels({
  plan,
  onPlanChange,
  occupied,
  activePlatform,
  onPlatformChange,
  onSaveDraft,
  onArm,
  saving,
  arming,
  locked = false,
  hideFooterActions = true,
}: Props) {
  function toggleChannel(channel: SchedulerChannel, platform: SimulatorPlatform) {
    onPlatformChange(platform)
    if (!plan) return
    onPlanChange(
      plan.map((slot) =>
        slot.channel === channel
          ? { ...slot, enabled: !slot.enabled }
          : slot
      )
    )
  }

  return (
    <section className="space-y-3 border-2 border-mad-black bg-mad-white p-3 shadow-keycap-sm">
      <div>
        <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Step 4 · Channels
        </p>
        <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
          Preview & schedule
        </h2>
        <p className="mt-1 text-xs text-neutral-600">
          Toggle channels — the phone preview switches to each native layout.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHANNEL_BUTTONS.map(({ channel, platform, label }) => {
          const slot = plan?.find((row) => row.channel === channel)
          const enabled = slot?.enabled ?? false
          const active = activePlatform === platform
          return (
            <button
              key={channel}
              type="button"
              onClick={() => toggleChannel(channel, platform)}
              className={cn(
                "border-2 border-mad-black px-2 py-1.5 font-typewriter text-[0.5rem] font-bold tracking-wider uppercase transition",
                enabled || active
                  ? "bg-mad-black text-mad-white"
                  : "bg-mad-white hover:bg-mad-lime"
              )}
            >
              {CHANNEL_META[channel].label}
            </button>
          )
        })}
      </div>

      {plan ? (
        <MultiChannelScheduler
          plan={plan}
          onPlanChange={onPlanChange}
          occupied={occupied}
          onSaveDraft={onSaveDraft}
          onArm={onArm}
          saving={saving}
          arming={arming}
          locked={locked}
          hideFooterActions={hideFooterActions}
        />
      ) : (
        <p className="border-2 border-mad-black px-3 py-6 text-center font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
          Calculating Brain timing…
        </p>
      )}
    </section>
  )
}
