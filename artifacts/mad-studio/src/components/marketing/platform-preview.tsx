"use client"

import { useMemo, useState } from "react"

import {
  pickDefaultVibeTag,
  resolveIndustryProfile,
  type IndustryBrandProfile,
} from "@/lib/brands/industry-templates"
import type { SopDraft } from "@/lib/inventory/sop"
import {
  formatInventoryPrice,
  type MarketingEntity,
} from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

export type PlatformChannel = "feed" | "story" | "email"

type Props = {
  item: MarketingEntity
  draft: SopDraft
  onDraftChange: (draft: SopDraft) => void
  selectedImageUrl: string | null
  brandName: string
  industry?: string | null
}

const CHANNELS: Array<{
  id: PlatformChannel
  label: string
  aspect: string
}> = [
  {
    id: "feed",
    label: "Instagram / Facebook Feed",
    aspect: "aspect-[4/5]",
  },
  {
    id: "story",
    label: "Instagram Story / Reel",
    aspect: "aspect-[9/16]",
  },
  {
    id: "email",
    label: "Email Newsletter Hero",
    aspect: "aspect-[16/9]",
  },
]

export function PlatformPreview({
  item,
  draft,
  onDraftChange,
  selectedImageUrl,
  brandName,
  industry = null,
}: Props) {
  const [channel, setChannel] = useState<PlatformChannel>("story")
  const [showOverlay, setShowOverlay] = useState(true)

  const profile = useMemo(
    () => resolveIndustryProfile({ name: brandName, industry }),
    [brandName, industry]
  )
  const active =
    CHANNELS.find((channelOption) => channelOption.id === channel) ??
    CHANNELS[0]
  const priceLabel = formatInventoryPrice(item.price)
  const designer = item.brand?.trim() || brandName
  const vibeTag = pickDefaultVibeTag(
    profile,
    `${item.title} ${item.description ?? ""} ${draft.headline}`
  )
  const specs = buildSpecsLine(item, priceLabel)

  return (
    <section
      className="space-y-4 rounded-2xl border p-5 shadow-sm"
      style={{
        borderColor: `${profile.theme.ink}22`,
        background: profile.theme.canvas === "#121211" ? "#1A1918" : "#FFFFFF",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.65rem] font-semibold tracking-[0.18em] uppercase"
            style={{ color: profile.theme.accent }}
          >
            {profile.theme.label} · {profile.storyTemplate.replace(/_/g, " ")}
          </p>
          <h2
            className="mt-1 text-base font-semibold tracking-tight"
            style={{ color: profile.theme.ink }}
          >
            Platform Preview
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {profile.tagline ||
              "Crop and proof the visual across feed, story, and email."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowOverlay((value) => !value)}
          className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            borderColor: profile.theme.ink,
            background: showOverlay ? profile.theme.ink : "transparent",
            color: showOverlay ? profile.theme.canvas : profile.theme.ink,
          }}
        >
          {showOverlay ? "Overlay on" : "Overlay off"}
        </button>
      </div>

      {profile.vibeTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {profile.vibeTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-1 text-[0.65rem] font-medium tracking-wide"
              style={{
                background:
                  tag === vibeTag ? profile.theme.accent : `${profile.theme.mist}`,
                color:
                  tag === vibeTag ? profile.theme.onAccent : profile.theme.ink,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((option) => {
          const activeTab = channel === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setChannel(option.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
              )}
              style={{
                borderColor: profile.theme.ink,
                background: activeTab ? profile.theme.ink : "transparent",
                color: activeTab ? profile.theme.canvas : profile.theme.ink,
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <div
          className={cn(
            "relative w-full overflow-hidden border shadow-sm",
            active.aspect,
            profile.id === "worn_label" ? "rounded-[1.75rem]" : "rounded-2xl"
          )}
          style={{
            borderColor: profile.theme.ink,
            background: profile.theme.mist,
          }}
        >
          {selectedImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedImageUrl}
              alt={item.title}
              className={cn(
                "absolute inset-0 size-full object-cover",
                profile.id === "fudi" && channel !== "email"
                  ? "scale-105"
                  : undefined
              )}
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center px-6 text-center"
              style={{ background: profile.theme.mist }}
            >
              <p className="text-sm" style={{ color: profile.theme.ink }}>
                Attach a product image to preview this crop.
              </p>
            </div>
          )}

          {showOverlay ? (
            profile.storyTemplate === "moody_noir_edit" ? (
              <MoodyNoirOverlay
                channel={channel}
                profile={profile}
                designer={designer}
                vibeTag={vibeTag}
                specs={specs}
                draft={draft}
                onDraftChange={onDraftChange}
              />
            ) : profile.storyTemplate === "fresh_bite_eatery" ? (
              <FreshBiteOverlay
                channel={channel}
                profile={profile}
                designer={designer}
                vibeTag={vibeTag}
                draft={draft}
                onDraftChange={onDraftChange}
              />
            ) : (
              <DefaultOverlay
                channel={channel}
                profile={profile}
                designer={designer}
                priceLabel={priceLabel}
                draft={draft}
                onDraftChange={onDraftChange}
              />
            )
          ) : null}
        </div>
        <p className="mt-2 text-center text-xs text-neutral-500">
          {active.label} ·{" "}
          {active.id === "feed" ? "4:5" : active.id === "story" ? "9:16" : "16:9"}
          {channel === "story" ? ` · ${profile.shopLinkLabel} sticker` : ""}
        </p>
      </div>
    </section>
  )
}

function buildSpecsLine(
  item: MarketingEntity,
  priceLabel: string
): string | null {
  const parts: string[] = []
  const description = item.description ?? ""
  const sizeMatch = description.match(/\bSize[:\s]*([A-Za-z0-9./\-]+)/i)
  if (sizeMatch?.[1]) parts.push(`Size ${sizeMatch[1]}`)
  else if (/\b(XS|S|M|L|XL|XXL)\b/i.test(`${item.title} ${description}`)) {
    const bare = `${item.title} ${description}`.match(/\b(XS|S|M|L|XL|XXL)\b/i)
    if (bare?.[1]) parts.push(`Size ${bare[1].toUpperCase()}`)
  }
  if (priceLabel !== "—") parts.push(priceLabel)
  return parts.length > 0 ? parts.join(" · ") : null
}

function MoodyNoirOverlay({
  channel,
  profile,
  designer,
  vibeTag,
  specs,
  draft,
  onDraftChange,
}: {
  channel: PlatformChannel
  profile: IndustryBrandProfile
  designer: string
  vibeTag: string | null
  specs: string | null
  draft: SopDraft
  onDraftChange: (draft: SopDraft) => void
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-2">
        {vibeTag ? (
          <span
            className="rounded-sm px-2 py-1 font-serif text-[0.65rem] tracking-wide"
            style={{
              background: profile.theme.accent,
              color: profile.theme.onAccent,
            }}
          >
            {vibeTag}
          </span>
        ) : (
          <span />
        )}
        <span
          className="rounded-sm px-2 py-1 text-[0.55rem] font-semibold tracking-[0.16em] uppercase"
          style={{
            background: `${profile.theme.canvas}CC`,
            color: profile.theme.ink,
          }}
        >
          {designer}
        </span>
      </div>

      <div
        className="space-y-2 border p-3"
        style={{
          background: `${profile.theme.canvas}E6`,
          borderColor: `${profile.theme.ink}33`,
        }}
      >
        <p
          className="font-serif text-[0.65rem] tracking-[0.14em] uppercase"
          style={{ color: profile.theme.accent }}
        >
          The Moody Noir Edit
        </p>
        <input
          value={draft.headline}
          onChange={(event) =>
            onDraftChange({ ...draft, headline: event.target.value })
          }
          className="w-full border-0 bg-transparent font-serif text-lg leading-tight outline-none"
          style={{ color: profile.theme.ink }}
          placeholder="Editorial headline"
        />
        {specs ? (
          <p
            className="text-[0.7rem] tracking-wide uppercase"
            style={{ color: `${profile.theme.ink}CC` }}
          >
            {specs}
          </p>
        ) : null}
        <textarea
          value={draft.caption}
          onChange={(event) =>
            onDraftChange({ ...draft, caption: event.target.value })
          }
          rows={channel === "email" ? 2 : 3}
          className="w-full resize-none border-0 bg-transparent text-xs leading-relaxed outline-none"
          style={{ color: `${profile.theme.ink}DD` }}
          placeholder="Provenance · fabric · fit"
        />
        {channel === "story" ? (
          <div className="flex justify-center pt-1">
            <span
              className="rounded-full px-4 py-1.5 text-[0.7rem] font-semibold tracking-wide"
              style={{
                background: profile.theme.ink,
                color: profile.theme.canvas,
              }}
            >
              {profile.shopLinkLabel}
            </span>
          </div>
        ) : null}
        {profile.locationFooter ? (
          <p
            className="pt-1 text-center text-[0.6rem] tracking-[0.12em] uppercase"
            style={{ color: `${profile.theme.ink}99` }}
          >
            {profile.locationFooter}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function FreshBiteOverlay({
  channel,
  profile,
  designer,
  vibeTag,
  draft,
  onDraftChange,
}: {
  channel: PlatformChannel
  profile: IndustryBrandProfile
  designer: string
  vibeTag: string | null
  draft: SopDraft
  onDraftChange: (draft: SopDraft) => void
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[0.65rem] font-semibold"
          style={{
            background: profile.theme.canvas,
            color: profile.theme.ink,
            boxShadow: `0 0 0 2px ${profile.theme.accent}`,
          }}
        >
          {vibeTag ?? "Neighborhood Special"}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[0.6rem] font-bold tracking-wide uppercase"
          style={{
            background: profile.theme.accent,
            color: profile.theme.onAccent,
          }}
        >
          {designer}
        </span>
      </div>

      <div className="space-y-2">
        <div
          className="rounded-2xl p-3 shadow-sm"
          style={{
            background: `${profile.theme.canvas}F2`,
            color: profile.theme.ink,
          }}
        >
          <p
            className="text-[0.65rem] font-semibold tracking-[0.14em] uppercase"
            style={{ color: profile.theme.accent }}
          >
            The Fresh Bite / Eatery Drop
          </p>
          <input
            value={draft.headline}
            onChange={(event) =>
              onDraftChange({ ...draft, headline: event.target.value })
            }
            className="mt-1 w-full border-0 bg-transparent text-lg font-semibold leading-tight outline-none"
            style={{ color: profile.theme.ink }}
            placeholder="Dish name / special"
          />
          <textarea
            value={draft.caption}
            onChange={(event) =>
              onDraftChange({ ...draft, caption: event.target.value })
            }
            rows={channel === "email" ? 2 : 3}
            className="mt-2 w-full resize-none border-0 bg-transparent text-xs leading-relaxed outline-none"
            style={{ color: `${profile.theme.ink}CC` }}
            placeholder="Craving note · chef angle · neighborhood invite"
          />
        </div>

        <div className="flex justify-center">
          <span
            className="rotate-[-2deg] rounded-md px-4 py-2 text-[0.75rem] font-bold tracking-wide shadow-sm"
            style={{
              background: profile.theme.accent,
              color: profile.theme.onAccent,
            }}
          >
            {profile.stickerCta}
          </span>
        </div>
      </div>
    </div>
  )
}

function DefaultOverlay({
  channel,
  profile,
  designer,
  priceLabel,
  draft,
  onDraftChange,
}: {
  channel: PlatformChannel
  profile: IndustryBrandProfile
  designer: string
  priceLabel: string
  draft: SopDraft
  onDraftChange: (draft: SopDraft) => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 space-y-2 bg-gradient-to-t from-black/70 via-black/35 to-transparent p-4">
      <span className="inline-flex rounded-full bg-white/90 px-2.5 py-0.5 text-[0.65rem] font-medium tracking-wide text-neutral-800 uppercase">
        {designer}
        {priceLabel !== "—" ? ` · ${priceLabel}` : ""}
      </span>
      <input
        value={draft.headline}
        onChange={(event) =>
          onDraftChange({ ...draft, headline: event.target.value })
        }
        className="w-full rounded-lg border border-white/20 bg-black/25 px-2 py-1.5 text-sm font-semibold text-white outline-none placeholder:text-white/60 focus:ring-1 focus:ring-white"
        placeholder="Headline"
      />
      <textarea
        value={draft.caption}
        onChange={(event) =>
          onDraftChange({ ...draft, caption: event.target.value })
        }
        rows={channel === "email" ? 2 : 3}
        className="w-full resize-none rounded-lg border border-white/20 bg-black/25 px-2 py-1.5 text-xs leading-relaxed text-white outline-none placeholder:text-white/60 focus:ring-1 focus:ring-white"
        placeholder="Caption"
      />
      {channel === "story" ? (
        <div className="flex justify-center">
          <span className="rounded-full bg-white px-4 py-1.5 text-[0.7rem] font-semibold text-neutral-900">
            {profile.shopLinkLabel}
          </span>
        </div>
      ) : null}
    </div>
  )
}
