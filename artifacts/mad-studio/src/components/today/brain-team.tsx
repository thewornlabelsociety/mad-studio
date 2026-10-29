"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "wouter"
import {
  ClipboardCheck,
  Copy,
  Film,
  GalleryHorizontal,
  Link2,
  Loader2,
  Palette,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react"
import { toast } from "sonner"

import {
  artDirectorPicks,
  merchandiserReport,
  type ArtDirectorFormat,
  type ArtDirectorPick,
} from "@/lib/brain/team"
import { IntakeCaptionMerchandiserTools } from "@/components/today/intake-caption-merchandiser-tools"
import type { IntakeCaptionDefaultSource } from "@/lib/inventory/intake-caption-default"
import type { MarketingEntity } from "@/lib/inventory/types"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  websiteUrl?: string | null
  isFashion: boolean
  intakeCaptionDefault: IntakeCaptionDefaultSource
  /** Newest unposted arrivals (Today's new drops). */
  items: MarketingEntity[]
  /** One role at a time in tabs, filling its column (desktop Today). */
  tabbed?: boolean
  /** Inside Studio: Build reloads the page so Studio picks up the new items. */
  fullReloadLinks?: boolean
  className?: string
}

type RoleTab = "merch" | "art" | "copy"

type Captions = {
  headline: string
  instagram: string
  facebook: string
  tiktok: string
  hashtags: string[]
}

const FORMAT_META: Record<ArtDirectorFormat, { label: string; icon: typeof Film }> = {
  carousel: { label: "Carousel", icon: GalleryHorizontal },
  story: { label: "Story + link", icon: Link2 },
  reel: { label: "Reel", icon: Film },
}

function studioHref(entityId: string, pick: ArtDirectorPick): string {
  const params = new URLSearchParams({
    eid: entityId,
    step: "2",
    fresh: "1",
    items: pick.items.map((item) => item.id).join(","),
    format: pick.format,
  })
  return `/studio?${params.toString()}`
}

function RoleCard({
  icon,
  role,
  summary,
  children,
  fill = false,
  hidden = false,
}: {
  icon: ReactNode
  role: string
  summary: string
  children: ReactNode
  /** Fill the panel and scroll inside (tabbed layout). */
  fill?: boolean
  hidden?: boolean
}) {
  return (
    <article
      hidden={hidden}
      className={cn(
        "flex min-w-0 flex-col bg-mad-white",
        fill ? "h-full min-h-0" : "border-2 border-mad-black shadow-keycap-sm"
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-start gap-2.5 border-b-2 border-mad-black px-3 py-2.5",
          fill && "hidden"
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center border-2 border-mad-black bg-mad-lime">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            {role}
          </p>
          <p className="text-sm font-semibold leading-snug text-mad-black">{summary}</p>
        </div>
      </header>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-2 p-3", fill && "overflow-y-auto")}>
        {fill ? <p className="text-sm font-semibold leading-snug text-mad-black">{summary}</p> : null}
        {children}
      </div>
    </article>
  )
}

/**
 * Brain team on Today: a Merchandiser, Art director and Copywriter working
 * from your real stock. Nothing is generated except words, and only when asked.
 */
export function BrainTeam({
  entityId,
  websiteUrl = null,
  isFashion,
  intakeCaptionDefault,
  items,
  tabbed = false,
  fullReloadLinks = false,
  className,
}: Props) {
  const [tab, setTab] = useState<RoleTab>("art")
  const [captionDefault, setCaptionDefault] =
    useState<IntakeCaptionDefaultSource>(intakeCaptionDefault)
  const [localItems, setLocalItems] = useState(items)

  useEffect(() => {
    setLocalItems(items)
  }, [items])

  useEffect(() => {
    setCaptionDefault(intakeCaptionDefault)
  }, [intakeCaptionDefault])
  const eid = encodeURIComponent(entityId)
  const report = useMemo(
    () =>
      merchandiserReport({
        items: localItems,
        entityId,
        websiteUrl,
        requireSize: isFashion,
      }),
    [localItems, entityId, websiteUrl, isFashion]
  )
  const picks = useMemo(
    () => artDirectorPicks({ items: localItems, isFashion, max: 5 }),
    [localItems, isFashion]
  )

  const [copyPickId, setCopyPickId] = useState<string | null>(null)
  const copyPick = picks.find((pick) => pick.id === copyPickId) ?? picks[0] ?? null
  const [writing, setWriting] = useState(false)
  const [captions, setCaptions] = useState<Record<string, Captions>>({})
  const current = copyPick ? captions[copyPick.id] ?? null : null

  async function writeCaptions(pick: ArtDirectorPick) {
    setCopyPickId(pick.id)
    setWriting(true)
    try {
      const response = await fetch("/api/brain/copywriter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          itemIds: pick.items.map((item) => item.id),
          format: pick.format,
          angle: pick.title,
        }),
      })
      const payload = (await response.json().catch(() => ({}))) as Captions & {
        error?: string
      }
      if (!response.ok || !payload.instagram) {
        throw new Error(payload.error ?? "The Copywriter couldn't write this one.")
      }
      setCaptions((all) => ({ ...all, [pick.id]: payload }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't write captions.")
    } finally {
      setWriting(false)
    }
  }

  function copyText(text: string) {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Couldn't copy."))
  }

  function openInStudio(pick: ArtDirectorPick, text: Captions) {
    const caption = [
      text.instagram,
      text.hashtags.length > 0 ? text.hashtags.map((tag) => `#${tag}`).join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n")
    try {
      sessionStorage.setItem(`studio-prompt:${entityId}`, caption.slice(0, 4000))
    } catch {
      // still open Studio
    }
    window.location.assign(studioHref(entityId, pick))
  }

  if (localItems.length === 0) return null

  const tabs: Array<{ id: RoleTab; label: string; icon: typeof Palette }> = [
    { id: "merch", label: "Merchandiser", icon: ClipboardCheck },
    { id: "art", label: "Art director", icon: Palette },
    { id: "copy", label: "Copywriter", icon: PenLine },
  ]

  return (
    <section
      aria-label="Brain team"
      className={cn(
        tabbed
          ? "flex min-h-0 flex-col border-2 border-mad-black bg-mad-white shadow-keycap-sm"
          : "space-y-3",
        className
      )}
    >
      {tabbed ? (
        <div className="shrink-0 border-b-2 border-mad-black">
          <p className="px-3 pt-2.5 font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Brain team · from your newest {items.length} arrivals
          </p>
          <div role="tablist" aria-label="Brain team roles" className="mt-2 grid grid-cols-3">
            {tabs.map((row) => {
              const Icon = row.icon
              const active = tab === row.id
              return (
                <button
                  key={row.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(row.id)}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 border-t-2 border-r-2 border-mad-black px-2 py-2 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase last:border-r-0",
                    active ? "bg-mad-black text-mad-white" : "bg-mad-white hover:bg-mad-lime"
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {row.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="font-typewriter text-[0.75rem] font-bold tracking-widest text-mad-vermillion uppercase">
            Brain team
          </p>
          <h2 className="mt-1 font-typewriter text-lg font-bold tracking-typewriter-tight text-mad-black uppercase">
            Today&apos;s suggestions
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            From your newest {localItems.length} unposted arrivals — real photos and
            details only. Each suggestion says why.
          </p>
        </div>
      )}

      <div
        className={cn(
          tabbed ? "min-h-0 flex-1" : "grid items-start gap-3 lg:grid-cols-3"
        )}
      >
        {/* Merchandiser */}
        <RoleCard
          fill={tabbed}
          hidden={tabbed && tab !== "merch"}
          icon={<ClipboardCheck className="size-4" aria-hidden />}
          role="Merchandiser"
          summary={
            report.findings.length === 0
              ? `All ${report.checked} new arrivals are ready to post`
              : `${report.ready} of ${report.checked} ready to post`
          }
        >
          {report.gaps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {report.gaps.map((gap) => (
                <span
                  key={gap.id}
                  className="border border-mad-black bg-neutral-100 px-1.5 py-0.5 font-typewriter text-[0.7rem] font-bold tracking-wide uppercase"
                >
                  {gap.count} need {gap.label}
                </span>
              ))}
            </div>
          ) : null}
          <ul className="divide-y divide-neutral-200">
            {report.findings.slice(0, 5).map((finding) => (
              <li key={finding.item.id} className="flex items-center gap-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-mad-black">
                    {finding.item.title}
                  </p>
                  <p className="truncate text-[0.75rem] text-neutral-600">
                    Missing: {finding.missing.map((m) => m.label.toLowerCase()).join(", ")}
                  </p>
                </div>
                <Link
                  href={`/inventory?eid=${eid}&item=${encodeURIComponent(finding.item.id)}`}
                  className="shrink-0 border-2 border-mad-black px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
                >
                  Fix
                </Link>
              </li>
            ))}
          </ul>
          {report.findings.length > 5 ? (
            <Link
              href={`/inventory?eid=${eid}`}
              className="mt-auto text-xs font-medium text-mad-black underline underline-offset-4"
            >
              {report.findings.length - 5} more in the Library
            </Link>
          ) : null}
          <IntakeCaptionMerchandiserTools
            entityId={entityId}
            defaultSource={captionDefault}
            onDefaultSourceChange={setCaptionDefault}
            items={localItems}
            onItemPatched={(itemId, patch) =>
              setLocalItems((current) =>
                current.map((row) =>
                  row.id === itemId ? { ...row, ...patch } : row
                )
              )
            }
          />
        </RoleCard>

        {/* Art director */}
        <RoleCard
          fill={tabbed}
          hidden={tabbed && tab !== "art"}
          icon={<Palette className="size-4" aria-hidden />}
          role="Art director"
          summary={
            picks.length === 0
              ? "No post ideas yet — add photos to new arrivals"
              : `${picks.length} post${picks.length === 1 ? "" : "s"} to make from new stock`
          }
        >
          <ul className="space-y-2">
            {picks.map((pick) => {
              const meta = FORMAT_META[pick.format]
              const Icon = meta.icon
              const selected = copyPick?.id === pick.id
              return (
                <li
                  key={pick.id}
                  className={cn(
                    "border-2 p-2",
                    selected ? "border-mad-black bg-mad-lime/15" : "border-neutral-200"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex shrink-0 -space-x-3">
                      {pick.items.slice(0, 3).map((item) => {
                        const src = item.images.find((url) => /^https?:\/\//i.test(url))
                        return src ? (
                          <img
                            key={item.id}
                            src={src}
                            alt=""
                            loading="lazy"
                            className="size-10 border-2 border-mad-white object-cover"
                          />
                        ) : null
                      })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="inline-flex items-center gap-1 font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-600 uppercase">
                        <Icon className="size-3" aria-hidden />
                        {meta.label}
                        {pick.items.length > 1 ? ` · ${pick.items.length} items` : ""}
                      </p>
                      <p className="truncate text-xs font-semibold text-mad-black">{pick.title}</p>
                      <p className="text-[0.75rem] leading-snug text-neutral-600">{pick.reason}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Link
                      href={studioHref(entityId, pick)}
                      onClick={(event) => {
                        if (!fullReloadLinks) return
                        event.preventDefault()
                        window.location.assign(studioHref(entityId, pick))
                      }}
                      className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion"
                    >
                      <Wand2 className="size-3" aria-hidden />
                      Build
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setCopyPickId(pick.id)
                        if (tabbed) setTab("copy")
                      }}
                      aria-pressed={selected}
                      className="inline-flex items-center gap-1 border-2 border-mad-black px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase hover:bg-mad-lime"
                    >
                      <PenLine className="size-3" aria-hidden />
                      Captions
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </RoleCard>

        {/* Copywriter */}
        <RoleCard
          fill={tabbed}
          hidden={tabbed && tab !== "copy"}
          icon={<PenLine className="size-4" aria-hidden />}
          role="Copywriter"
          summary={
            copyPick ? `Captions for: ${copyPick.title}` : "Pick a post to write for"
          }
        >
          {copyPick ? (
            current ? (
              <div className="space-y-2">
                <CaptionBlock label="On-image headline" text={current.headline} onCopy={copyText} />
                <CaptionBlock label="Instagram" text={current.instagram} onCopy={copyText} />
                <CaptionBlock label="Facebook" text={current.facebook} onCopy={copyText} />
                <CaptionBlock label="TikTok" text={current.tiktok} onCopy={copyText} />
                {current.hashtags.length > 0 ? (
                  <CaptionBlock
                    label="Hashtags"
                    text={current.hashtags.map((tag) => `#${tag}`).join(" ")}
                    onCopy={copyText}
                  />
                ) : null}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => openInStudio(copyPick, current)}
                    className="inline-flex items-center gap-1 border-2 border-mad-black bg-mad-black px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion"
                  >
                    <Wand2 className="size-3" aria-hidden />
                    Build with these
                  </button>
                  <button
                    type="button"
                    disabled={writing}
                    onClick={() => void writeCaptions(copyPick)}
                    className="inline-flex items-center gap-1 border-2 border-mad-black px-2 py-1 font-typewriter text-[0.7rem] font-bold tracking-wider uppercase hover:bg-mad-lime disabled:opacity-40"
                  >
                    {writing ? (
                      <Loader2 className="size-3 animate-spin" aria-hidden />
                    ) : (
                      <Sparkles className="size-3" aria-hidden />
                    )}
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-start gap-2">
                <p className="text-xs text-neutral-600">
                  Writes the on-image headline and captions for Instagram,
                  Facebook and TikTok in your brand voice — using only these
                  items&apos; real details.
                </p>
                <button
                  type="button"
                  disabled={writing}
                  onClick={() => void writeCaptions(copyPick)}
                  className="inline-flex items-center gap-1.5 border-2 border-mad-black bg-mad-black px-3 py-1.5 font-typewriter text-[0.72rem] font-bold tracking-wider text-mad-white uppercase hover:bg-mad-vermillion disabled:opacity-40"
                >
                  {writing ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-3.5" aria-hidden />
                  )}
                  {writing ? "Writing…" : "Write captions"}
                </button>
              </div>
            )
          ) : (
            <p className="text-xs text-neutral-600">
              The Art director&apos;s post ideas show up here to write for.
            </p>
          )}
        </RoleCard>
      </div>
    </section>
  )
}

function CaptionBlock({
  label,
  text,
  onCopy,
}: {
  label: string
  text: string
  onCopy: (text: string) => void
}) {
  return (
    <div className="border border-neutral-200 p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-typewriter text-[0.68rem] font-bold tracking-wider text-neutral-500 uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={() => onCopy(text)}
          aria-label={`Copy ${label}`}
          title="Copy"
          className="inline-flex size-6 items-center justify-center border border-mad-black hover:bg-mad-lime"
        >
          <Copy className="size-3" aria-hidden />
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-mad-black">{text}</p>
    </div>
  )
}
