"use client"

import { MultiChannelScheduler } from "@/components/marketing/multi-channel-scheduler"
import { StudioStepPanel } from "@/components/studio/studio-step-panel"
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
    <StudioStepPanel
      fill
      kicker="V · Schedule"
      title="Preview & schedule"
      description="Toggle channels — the phone preview switches to each native layout."
    >

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
                "rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase transition",
                enabled || active
                  ? "border-mad-black bg-mad-black text-mad-white"
                  : "border-neutral-200 bg-white hover:border-neutral-400"
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
        <p className="rounded-sm border border-dashed border-neutral-300 px-3 py-8 text-center text-sm text-neutral-500">
          Calculating Brain timing…
        </p>
      )}
    </StudioStepPanel>
  )
}
