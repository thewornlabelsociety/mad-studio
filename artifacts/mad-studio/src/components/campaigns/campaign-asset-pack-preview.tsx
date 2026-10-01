"use client"

import { channelLabelFromAssetPack } from "@/lib/campaigns/ledger"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"

type Props = {
  assetPack: unknown
}

function isPack(value: unknown): value is CampaignPack {
  return Boolean(value && typeof value === "object" && "campaign_title" in value)
}

export function CampaignAssetPackPreview({ assetPack }: Props) {
  if (!isPack(assetPack)) {
    return (
      <p className="text-sm text-neutral-500">
        No modular pack saved for this drop yet.
      </p>
    )
  }

  const modules = [
    {
      label: "Short video",
      detail: assetPack.short_video_script?.hook_visual,
    },
    {
      label: "Carousel",
      detail: assetPack.carousel?.title,
    },
    {
      label: "SEO caption",
      detail: assetPack.seo_caption?.caption_body?.slice(0, 120),
    },
    {
      label: "Email drop",
      detail: assetPack.email_drop?.subject_line,
    },
    {
      label: "B2B DM",
      detail: assetPack.b2b_dm?.message_text?.slice(0, 120),
    },
  ]

  return (
    <div className="space-y-2">
      <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-neutral-500 uppercase">
        5-piece asset pack · {channelLabelFromAssetPack(assetPack)}
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {modules.map((module) => (
          <div
            key={module.label}
            className="border-2 border-mad-black/20 bg-mad-white px-3 py-2"
          >
            <p className="font-typewriter text-[0.55rem] font-bold tracking-wider uppercase">
              {module.label}
            </p>
            <p className="mt-1 line-clamp-3 text-xs text-neutral-700">
              {module.detail?.trim() || "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
