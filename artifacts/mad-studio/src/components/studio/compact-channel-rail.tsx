"use client"

import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"
import {
  PlatformChannelIcon,
  PLATFORM_CHANNEL_TITLES,
} from "@/components/studio/platform-channel-icon"
import { META_PREVIEW_CHANNELS } from "@/components/studio/meta-preview-channels"
import { cn } from "@/lib/utils"

const EXTRA_CHANNELS: SimulatorPlatform[] = ["tiktok", "email"]

type Props = {
  platform: SimulatorPlatform
  onPlatformChange: (platform: SimulatorPlatform) => void
  /** Vertical pill beside preview (legacy) vs row under the phone. */
  placement?: "side" | "below"
  className?: string
}

function ChannelButtons({
  platform,
  onPlatformChange,
  layout,
}: {
  platform: SimulatorPlatform
  onPlatformChange: (platform: SimulatorPlatform) => void
  layout: "vertical" | "horizontal"
}) {
  const channelIds: SimulatorPlatform[] = [
    ...META_PREVIEW_CHANNELS.map((row) => row.id),
    ...EXTRA_CHANNELS,
  ]

  return (
    <>
      {channelIds.map((id) => {
        const active = platform === id
        return (
          <button
            key={`${layout}-${id}`}
            type="button"
            title={PLATFORM_CHANNEL_TITLES[id]}
            aria-label={PLATFORM_CHANNEL_TITLES[id]}
            aria-pressed={active}
            onClick={() => onPlatformChange(id)}
            className={cn(
              "flex items-center justify-center rounded-full border transition",
              layout === "vertical" ? "size-9" : "size-8 shrink-0",
              active
                ? "border-mad-black bg-mad-black text-mad-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
            )}
          >
            <PlatformChannelIcon platform={id} />
          </button>
        )
      })}
    </>
  )
}

export function CompactChannelRail({
  platform,
  onPlatformChange,
  placement = "side",
  className,
}: Props) {
  if (placement === "below") {
    return (
      <nav
        aria-label="Preview channel"
        className={cn(
          "flex w-full max-w-[min(100%,400px)] shrink-0 flex-row flex-wrap items-center justify-center gap-1.5 rounded-full border border-neutral-200/90 bg-white/90 p-2 shadow-sm",
          className
        )}
      >
        <ChannelButtons
          platform={platform}
          onPlatformChange={onPlatformChange}
          layout="horizontal"
        />
      </nav>
    )
  }

  return (
    <>
      <nav
        aria-label="Preview channel"
        className={cn(
          "hidden shrink-0 flex-col gap-1.5 rounded-full border border-neutral-200/90 bg-white/90 p-2 shadow-sm lg:flex",
          className
        )}
      >
        <ChannelButtons
          platform={platform}
          onPlatformChange={onPlatformChange}
          layout="vertical"
        />
      </nav>
      <nav
        aria-label="Preview channel"
        className={cn(
          "flex shrink-0 flex-row flex-wrap justify-center gap-1.5 rounded-full border border-neutral-200/90 bg-white/90 p-2 shadow-sm lg:hidden",
          className
        )}
      >
        <ChannelButtons
          platform={platform}
          onPlatformChange={onPlatformChange}
          layout="horizontal"
        />
      </nav>
    </>
  )
}
