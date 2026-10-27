"use client"

import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"
import { PlatformChannelIcon } from "@/components/studio/platform-channel-icon"
import {
  isSimulatorPlatform,
  STUDIO_PREVIEW_CHANNELS,
  studioPreviewChannelLabel,
  type StudioPreviewChannelId,
} from "@/components/studio/studio-preview-channels"
import { cn } from "@/lib/utils"

type Props = {
  platform: SimulatorPlatform
  onPlatformChange: (platform: SimulatorPlatform) => void
  /** Vertical pill beside preview (legacy), row under phone, or full-width top bar. */
  placement?: "side" | "below" | "top"
  className?: string
}

function ChannelButtons({
  platform,
  onPlatformChange,
  layout,
  showLabels,
}: {
  platform: SimulatorPlatform
  onPlatformChange: (platform: SimulatorPlatform) => void
  layout: "vertical" | "horizontal"
  showLabels?: boolean
}) {
  return (
    <>
      {STUDIO_PREVIEW_CHANNELS.map((channel) => {
        const active = isSimulatorPlatform(channel.id) && platform === channel.id
        const disabled = !channel.previewAvailable

        if (disabled) {
          return (
            <span
              key={`${layout}-${channel.id}`}
              title={channel.unavailableReason ?? `${channel.label} — preview unavailable`}
              className={cn(
                "flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-full border border-dashed border-neutral-300 bg-neutral-50 px-2 py-1 text-neutral-400",
                layout === "vertical" && "flex-col px-1.5 py-2"
              )}
              aria-disabled="true"
            >
              <PlatformChannelIcon
                platform={channel.id as StudioPreviewChannelId}
                className="opacity-50"
              />
              {showLabels ? (
                <span className="max-w-[5.5rem] truncate text-[10px] font-medium">
                  {channel.label}
                </span>
              ) : null}
              {showLabels ? (
                <span className="text-[9px] uppercase tracking-wide">Soon</span>
              ) : null}
            </span>
          )
        }

        const id = channel.id as SimulatorPlatform
        return (
          <button
            key={`${layout}-${channel.id}`}
            type="button"
            title={`${channel.label}${channel.publishSupported ? "" : " · preview only in Studio"}`}
            aria-label={channel.label}
            aria-pressed={active}
            onClick={() => onPlatformChange(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border transition",
              showLabels ? "px-2.5 py-1" : layout === "vertical" ? "size-9 justify-center" : "size-8 justify-center",
              active
                ? "border-mad-black bg-mad-black text-mad-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
            )}
          >
            <PlatformChannelIcon platform={id} />
            {showLabels ? (
              <span className="truncate text-[10px] font-medium sm:max-w-none sm:text-[11px]">
                {channel.label}
              </span>
            ) : null}
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
  if (placement === "top") {
    const activeLabel = studioPreviewChannelLabel(platform)
    return (
      <div
        className={cn(
          "w-full shrink-0 border-b border-neutral-200/90 bg-white px-2 py-1.5 sm:px-2.5",
          className
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <p className="hidden shrink-0 font-typewriter text-[9px] uppercase tracking-widest text-neutral-500 sm:block">
            Preview
          </p>
          <nav
            aria-label="Preview channel"
            className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:thin]"
          >
            <div className="flex w-max min-w-full items-center justify-start gap-1.5 sm:justify-center">
              <ChannelButtons
                platform={platform}
                onPlatformChange={onPlatformChange}
                layout="horizontal"
                showLabels
              />
            </div>
          </nav>
        </div>
        <p className="mt-1 text-[9px] leading-snug text-neutral-500 sm:text-center">
          Showing <span className="font-medium text-neutral-700">{activeLabel}</span>
          . Preview shows layout only — Story, TikTok and Email still use your
          existing review/schedule rules; nothing posts from this bar alone.
        </p>
      </div>
    )
  }

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
