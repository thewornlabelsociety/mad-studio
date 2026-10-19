"use client"

import type { ReactNode } from "react"
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Share2,
} from "lucide-react"

import {
  PROMO_EXPORT_WIDTH,
  promoExportHeight,
} from "@/lib/social-creative/export-promo-png"
import type { PromoPreviewChannel } from "@/lib/social-creative/promo-preview-channels"
import type { WornLabelCampaignConfig } from "@/types/social-creative"
import { cn } from "@/lib/utils"

const BRAND = "Worn Label Society"
const HANDLE = "@wornlabelsociety"

type Props = {
  channel: PromoPreviewChannel
  config: WornLabelCampaignConfig
  children: ReactNode
  className?: string
}

function PhoneFrame({
  children,
  story,
  className,
}: {
  children: ReactNode
  story: boolean
  className?: string
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[320px]", className)}>
      <div
        className="relative overflow-hidden border-2 border-mad-black bg-[#0b0b0c] p-2 shadow-keycap"
        style={{ borderRadius: 36 }}
      >
        <div className="pointer-events-none absolute top-3 left-1/2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div
          className={cn(
            "relative overflow-hidden bg-black",
            story ? "h-[568px]" : "max-h-[620px] min-h-[480px]"
          )}
          style={{ borderRadius: 28 }}
        >
          {children}
        </div>
      </div>
      <p className="mt-2 text-center font-typewriter text-[0.55rem] tracking-wider text-neutral-500 uppercase">
        Channel mock · not live
      </p>
    </div>
  )
}

function StoryChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 pt-8 pb-2 text-[0.55rem] font-semibold text-white">
        <span className="truncate">{HANDLE}</span>
        <span>···</span>
      </div>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  )
}

function FeedChrome({
  network,
  caption,
  children,
}: {
  network: "instagram" | "facebook"
  caption: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-neutral-900 text-[0.6rem] font-bold text-white">
          W
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.7rem] font-semibold text-neutral-900">
            {network === "facebook" ? BRAND : HANDLE}
          </p>
          <p className="text-[0.55rem] text-neutral-500">
            {network === "facebook" ? "Sponsored · Whangārei" : "Whangārei"}
          </p>
        </div>
        <MoreHorizontal className="size-4 text-neutral-500" />
      </div>
      <div className="shrink-0">{children}</div>
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="size-4 text-neutral-900" />
          <MessageCircle className="size-4 text-neutral-900" />
          <Share2 className="size-4 text-neutral-900" />
        </div>
        <Bookmark className="size-4 text-neutral-900" />
      </div>
      <p className="px-3 pb-3 text-[0.6rem] leading-relaxed text-neutral-800">
        <span className="font-semibold">{HANDLE} </span>
        {caption}
      </p>
    </div>
  )
}

function EmailChrome({
  subject,
  preview,
  children,
}: {
  subject: string
  preview: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex h-[568px] w-full max-w-[340px] flex-col overflow-hidden border-2 border-mad-black bg-[#f2f2f7] shadow-keycap">
      <div className="shrink-0 border-b border-neutral-200 bg-white px-4 pb-3 pt-10">
        <p className="text-[0.6rem] font-medium tracking-wide text-neutral-500 uppercase">
          Mail · sales blast
        </p>
        <p className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-900">
          {subject}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{preview}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
          {children}
          <div className="space-y-2 p-4">
            <p className="text-xs leading-relaxed text-neutral-600">{preview}</p>
            <button
              type="button"
              className="w-full rounded-full bg-neutral-900 py-2.5 text-xs font-semibold text-white"
            >
              Shop this week&apos;s tag color
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScaledCreative({ config, children }: { config: WornLabelCampaignConfig; children: ReactNode }) {
  const baseW = PROMO_EXPORT_WIDTH
  const baseH = promoExportHeight(config.aspectRatio)
  const isStory = config.aspectRatio === "9:16"
  const targetW = isStory ? 280 : 300
  const scale = targetW / baseW

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: targetW,
        height: baseH * scale,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: baseW,
          height: baseH,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function PromoPlatformPreview({
  channel,
  config,
  children,
  className,
}: Props) {
  const caption = [
    `${config.colorName} tag · ${config.discountText}`,
    config.dateLabel,
    config.headline,
    config.storeNotice,
  ]
    .filter(Boolean)
    .join(" · ")

  const emailSubject = `${config.colorName} tag sale — ${config.discountText}`
  const emailPreview = `${config.dateLabel} — ${config.headline}`

  if (channel === "email") {
    return (
      <div className={className}>
        <EmailChrome subject={emailSubject} preview={emailPreview}>
          <ScaledCreative config={config}>{children}</ScaledCreative>
        </EmailChrome>
      </div>
    )
  }

  if (channel === "instagram_story") {
    return (
      <PhoneFrame story className={className}>
        <StoryChrome>
          <ScaledCreative config={config}>{children}</ScaledCreative>
        </StoryChrome>
      </PhoneFrame>
    )
  }

  const network = channel === "facebook" ? "facebook" : "instagram"
  return (
    <PhoneFrame story={false} className={className}>
      <FeedChrome network={network} caption={caption}>
        <ScaledCreative config={config}>{children}</ScaledCreative>
      </FeedChrome>
    </PhoneFrame>
  )
}
