"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Loader2, Redo2, Save, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { saveCampaign } from "@/lib/actions"
import { MultiPlatformSimulator, type SimulatorPlatform } from "@/components/marketing/multi-platform-simulator"
import { detectMediaKindFromUrl } from "@/components/marketing/media-tray"
import { AutoTextarea } from "@/components/studio/auto-textarea"
import { usePackHistory } from "@/components/studio/use-pack-history"
import type { MultiplexerIntent } from "@/lib/campaigns/multiplexer"
import type { CampaignPack } from "@/lib/campaigns/pack-schema"
import { stripMarkdown } from "@/lib/campaigns/pack-schema"
import {
  resolveFudiTrackPresets,
  type FudiAudienceTrack,
} from "@/lib/studio/fudi-tracks"
import { cn } from "@/lib/utils"
import { trackableUrl } from "@/lib/social/types"

export type PackAssetKey =
  | "video"
  | "carousel"
  | "caption"
  | "email"
  | "dm"

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

type PackResultsEditorProps = {
  pack: CampaignPack
  campaignId: string | null
  brandName: string
  entityId: string
  eventDescription: string
  targetGoal: string
  targetSegment: string | null
  mediaUrl: string | null
  activeMedia?: import("@/components/marketing/media-tray").ActiveMedia | null
  intent?: MultiplexerIntent
  visualPresets?: import("@/lib/entities/dna-schema").VisualPresets | null
  industry?: string | null
  fudiTrack?: FudiAudienceTrack | null
  redirectSlugSeed?: string | null
  onPackChange: (pack: CampaignPack) => void
  onCampaignIdChange: (id: string) => void
}

function buildAssetTabs(fudiTrack?: FudiAudienceTrack | null): Array<{
  key: PackAssetKey
  label: string
  subtitle: string
  platform: SimulatorPlatform
}> {
  const labels = fudiTrack
    ? resolveFudiTrackPresets(fudiTrack).assetTabLabels
    : null

  return [
    {
      key: "video",
      label: labels?.video ?? "01 · Video Script",
      subtitle:
        fudiTrack === "diners"
          ? "TikTok Reel · appetite hook"
          : fudiTrack === "partners"
            ? "Partner reel · covers pitch"
            : "Hook · OCR · lines · CTA",
      platform: "tiktok",
    },
    {
      key: "carousel",
      label: labels?.carousel ?? "02 · Carousel Slides",
      subtitle:
        fudiTrack === "partners"
          ? "LinkedIn update frames"
          : "Headline + body per slide",
      platform: "ig_feed",
    },
    {
      key: "caption",
      label: labels?.caption ?? "03 · Caption",
      subtitle:
        fudiTrack === "diners"
          ? "IG Story + search food tags"
          : "Body + search tags",
      platform: "ig_story",
    },
    {
      key: "email",
      label: labels?.email ?? "04 · Email",
      subtitle:
        fudiTrack === "partners"
          ? "Founder cold email"
          : "Subject · preview · body",
      platform: "email",
    },
    {
      key: "dm",
      label: labels?.dm ?? "05 · B2B DM",
      subtitle:
        fudiTrack === "partners"
          ? "Direct B2B Instagram DM"
          : fudiTrack === "diners"
            ? "Social invite DM"
            : "Platform outreach message",
      platform: "facebook",
    },
  ]
}

const AUTO_SAVE_MS = 800

function FieldLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
      {children}
    </p>
  )
}

export function PackResultsEditor({
  pack,
  campaignId,
  brandName,
  entityId,
  eventDescription,
  targetGoal,
  targetSegment,
  mediaUrl,
  activeMedia = null,
  intent = "Drive Sales",
  visualPresets = null,
  industry = null,
  fudiTrack = null,
  redirectSlugSeed = null,
  onPackChange,
  onCampaignIdChange,
}: PackResultsEditorProps) {
  const [activeKey, setActiveKey] = useState<PackAssetKey>(
    fudiTrack === "partners" ? "dm" : "video"
  )
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [manualSaving, setManualSaving] = useState(false)
  const [slugCopied, setSlugCopied] = useState(false)
  const history = usePackHistory(pack)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipAutoSaveRef = useRef(false)
  const packFingerprint = useMemo(() => JSON.stringify(pack), [pack])
  const mountedRef = useRef(false)
  const assetTabs = useMemo(() => buildAssetTabs(fudiTrack), [fudiTrack])

  const activeTab =
    assetTabs.find((tab) => tab.key === activeKey) ?? assetTabs[0]

  function patchPack(updater: (current: CampaignPack) => CampaignPack) {
    history.beginEditBurst()
    onPackChange(updater(pack))
    setSaveStatus("dirty")
  }

  function commitEdit() {
    history.flushHistory()
  }

  async function persistPack(reason: "auto" | "manual") {
    if (reason === "manual") setManualSaving(true)
    setSaveStatus("saving")
    try {
      const result = await saveCampaign({
        entityId,
        eventDescription,
        targetGoal,
        targetSegment,
        pack,
        status: "draft",
        mediaUrl,
        campaignId,
        intent,
        fudiTrack,
      })
      if (!result.ok) {
        setSaveStatus("error")
        if (reason === "manual") toast.error(result.error)
        return
      }
      if (result.campaignId !== campaignId) {
        onCampaignIdChange(result.campaignId)
      }
      setSaveStatus("saved")
      if (reason === "manual") toast.success("Pack changes saved.")
    } catch (error) {
      setSaveStatus("error")
      if (reason === "manual") {
        toast.error(
          error instanceof Error ? error.message : "Failed to save pack."
        )
      }
    } finally {
      if (reason === "manual") setManualSaving(false)
    }
  }

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      skipAutoSaveRef.current = true
      return
    }
    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false
      return
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      void persistPack("auto")
    }, AUTO_SAVE_MS)
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
    // Intentionally keyed on fingerprint so each edit restarts idle debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packFingerprint])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey
      if (!mod) return

      const key = event.key.toLowerCase()
      if (key === "z" && !event.shiftKey) {
        event.preventDefault()
        const previous = history.undo()
        if (previous) {
          onPackChange(previous)
          setSaveStatus("dirty")
        }
        return
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault()
        const next = history.redo()
        if (next) {
          onPackChange(next)
          setSaveStatus("dirty")
        }
        return
      }
      if (key === "s") {
        event.preventDefault()
        history.flushHistory()
        void persistPack("manual")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  })

  async function copyActive() {
    const text = (() => {
      switch (activeKey) {
        case "video":
          return [
            pack.algorithmic_signals.spoken_hook,
            pack.algorithmic_signals.on_screen_text,
            ...pack.short_video_script.spoken_lines,
            pack.short_video_script.cta_spoken,
          ].join("\n\n")
        case "carousel":
          return [
            pack.carousel.title,
            ...pack.carousel.slides.map(
              (slide) =>
                `Slide ${slide.slide_number}: ${slide.headline}\n${slide.body_text}`
            ),
          ].join("\n\n")
        case "caption":
          return [
            pack.seo_caption.caption_body,
            pack.seo_caption.search_optimized_tags.join(" "),
          ].join("\n\n")
        case "email":
          return [
            pack.email_drop.subject_line,
            pack.email_drop.preview_text,
            pack.email_drop.body_markdown,
          ].join("\n\n")
        case "dm":
          return pack.b2b_dm.message_text
      }
    })()
    await navigator.clipboard.writeText(text)
    toast.success(`${activeTab.label} copied.`)
  }

  function runUndo() {
    const previous = history.undo()
    if (!previous) return
    onPackChange(previous)
    setSaveStatus("dirty")
  }

  function runRedo() {
    const next = history.redo()
    if (!next) return
    onPackChange(next)
    setSaveStatus("dirty")
  }

  async function copyRedirectSlug() {
    if (!redirectSlugSeed) return
    const short = trackableUrl(redirectSlugSeed)
    await navigator.clipboard.writeText(short)
    setSlugCopied(true)
    window.setTimeout(() => setSlugCopied(false), 1600)
    toast.success("Track redirect copied.")
  }

  return (
    <section className="border-2 border-mad-black bg-mad-white p-4 shadow-keycap">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-typewriter text-[0.65rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Asset Studio Preview
          </p>
          <h2 className="font-typewriter text-sm font-bold tracking-typewriter-tight text-mad-black uppercase">
            Editable five-pack · live device sync
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-neutral-600">
            Open one tab to edit that channel. Use{" "}
            <span className="font-medium text-mad-black">Copy this asset</span>{" "}
            when you only need that piece.{" "}
            <span className="font-medium text-mad-black">Dispatch</span> still
            sends the full five-pack to automation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatusPill status={saveStatus} />
          {redirectSlugSeed ? (
            <button
              type="button"
              onClick={() => void copyRedirectSlug()}
              className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-lime px-2.5 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm"
              title={
                fudiTrack === "partners"
                  ? "Partner onboarding redirect"
                  : "Consumer diner redirect"
              }
            >
              {slugCopied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              /r/{redirectSlugSeed}
            </button>
          ) : null}
          <button
            type="button"
            onClick={runUndo}
            disabled={!history.canUndo}
            title="Undo (Ctrl/Cmd+Z)"
            className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-white px-2.5 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm disabled:opacity-40"
          >
            <Undo2 className="size-3.5" />
            Undo
          </button>
          <button
            type="button"
            onClick={runRedo}
            disabled={!history.canRedo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-white px-2.5 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider uppercase shadow-keycap-sm disabled:opacity-40"
          >
            <Redo2 className="size-3.5" />
            Redo
          </button>
          <button
            type="button"
            onClick={() => {
              history.flushHistory()
              void persistPack("manual")
            }}
            disabled={manualSaving || saveStatus === "saving"}
            className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 py-2 font-typewriter text-[0.6rem] font-bold tracking-wider text-mad-white uppercase shadow-keycap-sm hover:bg-mad-vermillion disabled:opacity-60"
          >
            {manualSaving || saveStatus === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2">
        {assetTabs.map((tab) => {
          const active = tab.key === activeKey
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveKey(tab.key)}
              className={cn(
                "shrink-0 whitespace-nowrap border-2 border-mad-black px-3 py-2 text-left shadow-keycap-sm",
                active
                  ? "bg-mad-black text-mad-white"
                  : "bg-mad-white text-mad-black hover:bg-mad-lime"
              )}
            >
              <p className="font-typewriter text-[0.6rem] font-bold tracking-widest uppercase">
                {tab.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[0.65rem]",
                  active ? "text-white/70" : "text-neutral-500"
                )}
              >
                {tab.subtitle}
              </p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-3">
          <article className="border-2 border-mad-black bg-mad-white shadow-keycap-sm">
            <header className="flex items-start justify-between gap-2 border-b-2 border-mad-black bg-neutral-50 px-3 py-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-black uppercase">
                    {activeTab.label}
                  </p>
                  <SaveStatusPill status={saveStatus} compact />
                </div>
                <p className="text-[0.65rem] text-neutral-500">
                  Edits sync to the phone preview instantly
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={runUndo}
                  disabled={!history.canUndo}
                  className="inline-flex items-center gap-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase disabled:opacity-40"
                >
                  <Undo2 className="size-3" />
                  Undo
                </button>
                <button
                  type="button"
                  onClick={copyActive}
                  className="inline-flex items-center gap-1 font-typewriter text-[0.55rem] font-bold tracking-wider text-mad-black uppercase hover:text-mad-vermillion"
                >
                  <Copy className="size-3" />
                  Copy this asset
                </button>
              </div>
            </header>

            <div className="space-y-4 px-3 py-3">
              {activeKey === "video" ? (
                <>
                  <div>
                    <FieldLabel>Spoken hook</FieldLabel>
                    <AutoTextarea
                      value={pack.algorithmic_signals.spoken_hook}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          algorithmic_signals: {
                            ...current.algorithmic_signals,
                            spoken_hook: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>On-screen headline / OCR</FieldLabel>
                    <AutoTextarea
                      value={pack.algorithmic_signals.on_screen_text}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          algorithmic_signals: {
                            ...current.algorithmic_signals,
                            on_screen_text: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={1}
                    />
                  </div>
                  <div>
                    <FieldLabel>Spoken lines (one per line)</FieldLabel>
                    <AutoTextarea
                      value={pack.short_video_script.spoken_lines.join("\n")}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          short_video_script: {
                            ...current.short_video_script,
                            spoken_lines: value.split("\n"),
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={4}
                    />
                  </div>
                  <div>
                    <FieldLabel>CTA</FieldLabel>
                    <AutoTextarea
                      value={pack.short_video_script.cta_spoken}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          short_video_script: {
                            ...current.short_video_script,
                            cta_spoken: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={2}
                    />
                  </div>
                </>
              ) : null}

              {activeKey === "carousel" ? (
                <>
                  <div>
                    <FieldLabel>Deck title</FieldLabel>
                    <AutoTextarea
                      value={pack.carousel.title}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          carousel: { ...current.carousel, title: value },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={1}
                    />
                  </div>
                  {pack.carousel.slides.map((slide, index) => (
                    <div
                      key={`slide-${slide.slide_number}-${index}`}
                      className="space-y-2 border border-neutral-200 p-2"
                    >
                      <p className="font-typewriter text-[0.55rem] font-bold tracking-widest text-mad-vermillion uppercase">
                        Slide {slide.slide_number}
                      </p>
                      <div>
                        <FieldLabel>Headline</FieldLabel>
                        <AutoTextarea
                          value={slide.headline}
                          onValueChange={(value) =>
                            patchPack((current) => ({
                              ...current,
                              carousel: {
                                ...current.carousel,
                                slides: current.carousel.slides.map(
                                  (entry, entryIndex) =>
                                    entryIndex === index
                                      ? { ...entry, headline: value }
                                      : entry
                                ),
                              },
                            }))
                          }
                          onCommit={commitEdit}
                          rows={1}
                        />
                      </div>
                      <div>
                        <FieldLabel>Body</FieldLabel>
                        <AutoTextarea
                          value={slide.body_text}
                          onValueChange={(value) =>
                            patchPack((current) => ({
                              ...current,
                              carousel: {
                                ...current.carousel,
                                slides: current.carousel.slides.map(
                                  (entry, entryIndex) =>
                                    entryIndex === index
                                      ? { ...entry, body_text: value }
                                      : entry
                                ),
                              },
                            }))
                          }
                          onCommit={commitEdit}
                          rows={3}
                        />
                      </div>
                    </div>
                  ))}
                </>
              ) : null}

              {activeKey === "caption" ? (
                <>
                  <div>
                    <FieldLabel>Caption body</FieldLabel>
                    <AutoTextarea
                      value={pack.seo_caption.caption_body}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          seo_caption: {
                            ...current.seo_caption,
                            caption_body: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={5}
                    />
                  </div>
                  <div>
                    <FieldLabel>Tags (space-separated)</FieldLabel>
                    <AutoTextarea
                      value={pack.seo_caption.search_optimized_tags.join(" ")}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          seo_caption: {
                            ...current.seo_caption,
                            search_optimized_tags: value
                              .split(/\s+/)
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={2}
                    />
                  </div>
                </>
              ) : null}

              {activeKey === "email" ? (
                <>
                  <div>
                    <FieldLabel>Subject / headline</FieldLabel>
                    <AutoTextarea
                      value={pack.email_drop.subject_line}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          email_drop: {
                            ...current.email_drop,
                            subject_line: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={1}
                    />
                  </div>
                  <div>
                    <FieldLabel>Preview text</FieldLabel>
                    <AutoTextarea
                      value={pack.email_drop.preview_text}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          email_drop: {
                            ...current.email_drop,
                            preview_text: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={2}
                    />
                  </div>
                  <div>
                    <FieldLabel>Body</FieldLabel>
                    <AutoTextarea
                      value={pack.email_drop.body_markdown}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          email_drop: {
                            ...current.email_drop,
                            body_markdown: value,
                          },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={8}
                    />
                  </div>
                </>
              ) : null}

              {activeKey === "dm" ? (
                <>
                  <div>
                    <FieldLabel>Platform</FieldLabel>
                    <AutoTextarea
                      value={pack.b2b_dm.platform}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          b2b_dm: { ...current.b2b_dm, platform: value },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={1}
                    />
                  </div>
                  <div>
                    <FieldLabel>Message / CTA</FieldLabel>
                    <AutoTextarea
                      value={pack.b2b_dm.message_text}
                      onValueChange={(value) =>
                        patchPack((current) => ({
                          ...current,
                          b2b_dm: { ...current.b2b_dm, message_text: value },
                        }))
                      }
                      onCommit={commitEdit}
                      rows={8}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </article>
        </div>

        <div className="mx-auto w-full max-w-[380px] shrink-0 xl:sticky xl:top-4 xl:mx-0 xl:w-[380px] xl:self-start">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
              Live preview
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={runUndo}
                disabled={!history.canUndo}
                className="rounded-full border border-neutral-200 bg-white p-1.5 shadow-sm disabled:opacity-40"
                title="Undo"
              >
                <Undo2 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={runRedo}
                disabled={!history.canRedo}
                className="rounded-full border border-neutral-200 bg-white p-1.5 shadow-sm disabled:opacity-40"
                title="Redo"
              >
                <Redo2 className="size-3.5" />
              </button>
            </div>
          </div>
          <MultiPlatformSimulator
            content={{
              brandName,
              headline:
                pack.algorithmic_signals.on_screen_text ||
                pack.carousel.slides[0]?.headline ||
                pack.campaign_title,
              caption:
                activeKey === "dm"
                  ? pack.b2b_dm.message_text
                  : activeKey === "video"
                    ? pack.algorithmic_signals.spoken_hook
                    : pack.seo_caption.caption_body,
              imageUrl: mediaUrl,
              stickerLabel: "SHOP HERE",
              emailSubject: pack.email_drop.subject_line,
              emailPreview:
                pack.email_drop.preview_text ||
                stripMarkdown(pack.email_drop.body_markdown).slice(0, 120),
            }}
            activeMedia={
              activeMedia ??
              (mediaUrl
                ? {
                    url: mediaUrl,
                    type: detectMediaKindFromUrl(mediaUrl),
                  }
                : null)
            }
            carouselMedia={
              mediaUrl && pack.carousel.slides.length > 1
                ? pack.carousel.slides.map((slide, index) => ({
                    id: `pack-slide-${slide.slide_number ?? index}`,
                    url: mediaUrl,
                    type: detectMediaKindFromUrl(mediaUrl),
                  }))
                : null
            }
            slideTexts={pack.carousel.slides.map((slide) => slide.headline)}
            onSlideTextsChange={(texts) => {
              patchPack((current) => ({
                ...current,
                carousel: {
                  ...current.carousel,
                  slides: current.carousel.slides.map((slide, index) => ({
                    ...slide,
                    headline: texts[index] ?? slide.headline,
                  })),
                },
              }))
            }}
            platform={activeTab.platform}
            onPlatformChange={(next) => {
              const match = assetTabs.find((tab) => tab.platform === next)
              if (match) setActiveKey(match.key)
            }}
            industry={industry}
            visualPresets={visualPresets}
            stacked
          />
        </div>
      </div>
    </section>
  )
}

function SaveStatusPill({
  status,
  compact = false,
}: {
  status: SaveStatus
  compact?: boolean
}) {
  if (status === "idle") return null

  const label =
    status === "saving"
      ? "Saving..."
      : status === "saved"
        ? "Saved"
        : status === "dirty"
          ? "Unsaved"
          : "Save failed"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-typewriter font-bold tracking-wider uppercase",
        compact ? "text-[0.5rem]" : "text-[0.6rem]",
        status === "saved"
          ? "text-emerald-700"
          : status === "error"
            ? "text-mad-vermillion"
            : "text-neutral-500"
      )}
    >
      {status === "saving" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : status === "saved" ? (
        <Check className="size-3" />
      ) : null}
      {label}
      {status === "saved" ? " (✓)" : null}
    </span>
  )
}
