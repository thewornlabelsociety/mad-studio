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
              "flex items-center justify-center border-2 border-mad-black transition",
              layout === "vertical" ? "size-10" : "size-9 shrink-0",
              active
                ? "bg-mad-black text-mad-white"
                : "bg-mad-white text-mad-black hover:bg-mad-lime"
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
  className,
}: Props) {
  return (
    <>
      <nav
        aria-label="Preview channel"
        className={cn(
          "hidden shrink-0 flex-col gap-1 border-2 border-mad-black bg-mad-white p-1.5 shadow-keycap-sm lg:flex",
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
          "flex shrink-0 flex-row flex-wrap justify-center gap-1 border-2 border-mad-black bg-mad-white p-1 shadow-keycap-sm lg:hidden",
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
