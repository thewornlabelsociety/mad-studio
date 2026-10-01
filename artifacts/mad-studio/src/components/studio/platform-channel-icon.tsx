"use client"

import { Mail } from "lucide-react"
import { SiFacebook, SiInstagram, SiTiktok } from "react-icons/si"

import type { SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"
import { cn } from "@/lib/utils"

type Props = {
  platform: SimulatorPlatform
  className?: string
}

/** Brand marks for compact channel rail (monochrome via currentColor). */
export function PlatformChannelIcon({ platform, className }: Props) {
  const iconClass = cn("size-[1.35rem] shrink-0", className)

  switch (platform) {
    case "ig_story":
      return (
        <span className="relative inline-flex">
          <SiInstagram className={iconClass} aria-hidden />
          <span
            className="pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full border border-current bg-transparent"
            aria-hidden
          />
        </span>
      )
    case "ig_feed":
      return <SiInstagram className={iconClass} aria-hidden />
    case "facebook":
      return <SiFacebook className={iconClass} aria-hidden />
    case "tiktok":
      return <SiTiktok className={iconClass} aria-hidden />
    case "email":
      return <Mail className={iconClass} strokeWidth={2.25} aria-hidden />
    default:
      return null
  }
}

export const PLATFORM_CHANNEL_TITLES: Record<SimulatorPlatform, string> = {
  ig_story: "Instagram Story",
  ig_feed: "Instagram Feed",
  tiktok: "TikTok",
  facebook: "Facebook Page",
  email: "VIP Email",
}
