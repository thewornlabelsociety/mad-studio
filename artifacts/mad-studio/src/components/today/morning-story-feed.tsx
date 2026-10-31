"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "wouter"
import {
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Scissors,
  Download,
  FolderOpen,
  Share2,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"

import { KitStoryCanvas } from "@/components/templates/kit-story-canvas"
import {
  canSaveToFolder,
  chooseFolder,
  folderForSaving,
  folderRefusalReason,
  savedFolderName,
  todaysSubfolder,
  writeToFolder,
} from "@/lib/media/save-to-folder"
import { parseApiJsonResponse } from "@/lib/api/parse-response"
import type { VisualPresets } from "@/lib/entities/dna-schema"
import {
  bakeStoryPng,
  downloadImages,
  onTouchDevice,
  copyStoryLink,
  shareOrDownloadStory,
  shareStoryFiles,
  storyCardWords,
  useKitStories,
  warmStoryNode,
  type KitStory,
} from "@/lib/templates/use-kit-stories"
import { notifyInventorySynced } from "@/lib/studio/pull-new-arrivals-client"
import { cn } from "@/lib/utils"

/** How many new arrivals the morning feed offers at once. */
const FEED_SIZE = 6
/** How many more Stories "Show more" adds to the row. */
const MORE_SIZE = 10
/** How many Stories Save all builds at once. */
const BAKE_AT_ONCE = 3
const COLLAPSE_KEY = "mad.today.storyFeed.collapsed"

/** Stories saved today on this device, so each card can show a Saved tick. */
function savedKey(entityId: string): string {
  const now = new Date()
  return `mad.today.storySaved.${entityId}.${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

function readSaved(entityId: string): Record<string, true> {
  try {
    const raw = window.localStorage.getItem(savedKey(entityId))
    return raw ? (JSON.parse(raw) as Record<string, true>) : {}
  } catch {
    return {}
  }
}

type Props = {
  entityId: string
  entityName: string
  industry: string | null
  brandIdentity: { visual_presets?: VisualPresets | null } | null
  /** Smaller cards for the desktop dashboard. */
  compact?: boolean
  className?: string
}

function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1"
  } catch {
    return false
  }
}

/**
 * Today's new arrival Stories, finished and ready: save the image, post it,
 * paste the shop link into a sticker, then mark it shared.
 */
export function MorningStoryFeed({
  entityId,
  entityName,
  industry,
  brandIdentity,
  compact = false,
  className,
}: Props) {
  const nodes = useRef<Record<string, HTMLDivElement | null>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingAll, setSavingAll] = useState<{ done: number; total: number } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Phones share to Instagram or Photos; computers download straight to the Downloads folder.
  const [onPhone] = useState(onTouchDevice)
  // On a computer with Chrome or Edge, Stories go straight into a chosen folder (e.g. Dropbox).
  const [useFolder] = useState(() => !onTouchDevice() && canSaveToFolder())
  const [folderName, setFolderName] = useState<string | null>(null)
  useEffect(() => {
    if (useFolder) void savedFolderName().then(setFolderName)
  }, [useFolder])
  const savedWord = onPhone ? "Saved" : useFolder ? "Saved" : "Downloaded"

  /** The folder to write into, asking for it (or permission) when needed. */
  async function folderOrAsk() {
    try {
      const result = await folderForSaving()
      if (!result.ok) {
        const reason = folderRefusalReason()
        toast.message(
          result.reason === "not-allowed"
            ? "Chrome didn't allow saving to that folder, so they're downloading instead."
            : `Chrome didn't hand over a folder${reason ? ` (${reason})` : ""}, so they're downloading instead.`,
          { duration: 10000 }
        )
        return null
      }
      setFolderName(result.folder.name)
      return result.folder
    } catch (error) {
      toast.error(error instanceof Error ? `Couldn't use that folder: ${error.message}` : "Couldn't use that folder.")
      return null
    }
  }
  const [savedIds, setSavedIds] = useState<Record<string, true>>(() => readSaved(entityId))

  function markSaved(ids: string[]) {
    setSavedIds((current) => {
      const next = { ...current }
      for (const id of ids) next[id] = true
      try {
        window.localStorage.setItem(savedKey(entityId), JSON.stringify(next))
      } catch {
        /* the tick lasts until the page closes */
      }
      return next
    })
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [syncing, setSyncing] = useState(false)

  // Ids shown in the feed are decided from the first load, then held steady
  // so marking one shared doesn't reshuffle the row.
  const [feedIds, setFeedIds] = useState<string[] | null>(null)

  const kitStories = useKitStories({
    entityId,
    entityName,
    industry,
    brandIdentity,
    isWornLabel: true,
    cutoutIds: feedIds ?? [],
  })
  const { eligible, loaded, loading, reload, stories, patch, kit, cuttingId, cutoutFailed, retryCutout, sharedAt, markShared } =
    kitStories

  useEffect(() => {
    if (!loaded || loading || feedIds !== null) return
    setFeedIds(
      eligible
        .filter((row) => {
          const shared = row.usage.storySharedAt
          return !shared || isToday(shared)
        })
        .slice(0, FEED_SIZE)
        .map((row) => row.marketingEntityId)
    )
  }, [loaded, loading, feedIds, eligible])

  const feed = useMemo(
    () =>
      (feedIds ?? [])
        .map((id) => stories.get(id))
        .filter((story): story is KitStory => Boolean(story)),
    [feedIds, stories]
  )
  // On a computer, get the row ready to save in the background (photos and fonts).
  const feedKey = feed.map((story) => `${story.row.marketingEntityId}:${story.cutoutUrl ?? ""}`).join("|")
  useEffect(() => {
    if (onPhone || !feedKey) return
    const timer = window.setTimeout(() => {
      for (const node of Object.values(nodes.current)) if (node) warmStoryNode(node)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [onPhone, feedKey])

  const sharedCount = feed.filter((story) => sharedAt[story.row.marketingEntityId]).length

  /** Unshared new arrivals not in the row yet, newest first. */
  const waiting = useMemo(() => {
    const shown = new Set(feedIds ?? [])
    return eligible.filter(
      (row) => !shown.has(row.marketingEntityId) && !row.usage.storySharedAt && !sharedAt[row.marketingEntityId]
    )
  }, [eligible, feedIds, sharedAt])

  function showMore() {
    setFeedIds((current) => [
      ...(current ?? []),
      ...waiting.slice(0, MORE_SIZE).map((row) => row.marketingEntityId),
    ])
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, current ? "0" : "1")
      } catch {
        /* remembered for this visit only */
      }
      return !current
    })
  }

  async function onSave(story: KitStory) {
    const node = nodes.current[story.row.marketingEntityId]
    if (!node) return
    // Ask for the folder first, while this still counts as your click.
    // No folder (cancelled or refused): download instead.
    const folder = useFolder ? await folderOrAsk() : null
    setSavingId(story.row.marketingEntityId)
    try {
      const baked = await bakeStoryPng(node)
      if (folder) {
        const sub = todaysSubfolder()
        await writeToFolder(folder, sub, [{ blob: baked.blob, filename: `wls-story-${story.row.websiteItemId}.png` }])
        markSaved([story.row.marketingEntityId])
        toast.success(`Saved to ${folder.name} › ${sub}`)
        return
      }
      const id = story.row.marketingEntityId
      // A Save tapped later (phone) marks it saved then.
      const result = await shareOrDownloadStory(
        { ...baked, filename: `wls-story-${story.row.websiteItemId}.png` },
        () => markSaved([id])
      )
      if (result === "downloaded") {
        toast.success("Story image downloaded.")
        markSaved([id])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the image.")
    } finally {
      setSavingId(null)
    }
  }

  /** Stories in the row that are ready and not shared yet (not the ones behind More new arrivals). */
  const readyToSave = feed.filter((story) => {
    const id = story.row.marketingEntityId
    const cutReady = Boolean(story.cutoutUrl) || Boolean(cutoutFailed[id])
    return !sharedAt[id] && cutReady && Boolean(story.imageUrl)
  })

  /** The ticked Stories that are ready (any, shared or not); none ticked means all ready ones. */
  const selectedReady = feed.filter((story) => {
    const id = story.row.marketingEntityId
    return selected.has(id) && (Boolean(story.cutoutUrl) || Boolean(cutoutFailed[id])) && Boolean(story.imageUrl)
  })
  const toSave = selected.size > 0 ? selectedReady : readyToSave

  /** Every Story showing (or the ticked ones) in one go: one share sheet on a phone, a download each on a computer. */
  async function onSaveAll() {
    const stories = toSave
    if (stories.length === 0) return
    const folder = useFolder ? await folderOrAsk() : null
    setSavingAll({ done: 0, total: stories.length })
    try {
      // A few at a time, so one photo downloads while another is drawn.
      const baked: Array<{ dataUrl: string; blob: Blob; filename: string }> = []
      let done = 0
      for (let start = 0; start < stories.length; start += BAKE_AT_ONCE) {
        const batch = await Promise.all(
          stories.slice(start, start + BAKE_AT_ONCE).map(async (story) => {
            const node = nodes.current[story.row.marketingEntityId]
            if (!node) return null
            const image = await bakeStoryPng(node)
            done++
            setSavingAll({ done, total: stories.length })
            return { ...image, filename: `wls-story-${story.row.websiteItemId}.png` }
          })
        )
        for (const row of batch) if (row) baked.push(row)
      }
      const files = baked.map((row) => new File([row.blob], row.filename, { type: "image/png" }))
      const ids = stories.map((story) => story.row.marketingEntityId)
      if (folder) {
        const sub = todaysSubfolder()
        const written = await writeToFolder(folder, sub, baked)
        markSaved(ids)
        setSelected(new Set())
        toast.success(`${written} Stories saved to ${folder.name} › ${sub}`)
        return
      }
      if (onPhone && navigator.canShare?.({ files })) {
        await shareStoryFiles(files, () => {
          markSaved(ids)
          setSelected(new Set())
        })
        return
      }
      await downloadImages(baked)
      markSaved(ids)
      setSelected(new Set())
      toast.success(`${baked.length} Story images downloaded. Post them, then mark each one shared.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the images.")
    } finally {
      setSavingAll(null)
    }
  }

  /** Pull new stock from the shop (also picks up markdowns), then rebuild the feed. */
  async function onRefresh() {
    setSyncing(true)
    try {
      const response = await fetch("/api/sync/pull-new-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId }),
      })
      const payload = await parseApiJsonResponse<{ imported?: number; message?: string; error?: string }>(response)
      if (!response.ok) throw new Error(payload.error ?? "Couldn't check the shop.")
      toast.success(
        payload.imported
          ? `${payload.imported} new arrival${payload.imported === 1 ? "" : "s"} from the shop.`
          : "Up to date with the shop."
      )
      notifyInventorySynced(entityId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't check the shop.")
    } finally {
      setSyncing(false)
      setFeedIds(null)
      void reload()
    }
  }

  const cardWidth = compact ? "w-[168px]" : "w-[min(72vw,260px)] md:w-[200px]"

  return (
    <section
      aria-labelledby="story-feed-heading"
      className={cn("overflow-hidden border-2 border-mad-black bg-white", className)}
    >
      <header className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="story-feed-body"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn("size-4 shrink-0 transition-transform", collapsed && "-rotate-90")}
            aria-hidden
          />
          <h2 id="story-feed-heading" className="font-typewriter text-xs font-bold uppercase tracking-widest">
            Today&apos;s Stories
          </h2>
          {feed.length > 0 ? (
            <span className="text-xs text-mad-black/60">
              {sharedCount} of {feed.length} shared
            </span>
          ) : null}
        </button>
        {feed.length > 0 ? (
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-mad-black/10 sm:block" aria-hidden>
            <div
              className="h-full bg-mad-black transition-all"
              style={{ width: `${(sharedCount / feed.length) * 100}%` }}
            />
          </div>
        ) : null}
        {toSave.length > 1 || selected.size > 0 ? (
          <button
            type="button"
            onClick={() => void onSaveAll()}
            disabled={savingAll != null || savingId != null || toSave.length === 0}
            title={selected.size > 0 ? "Save the Stories you ticked" : "Save every Story showing (not the ones behind Show more)"}
            className="flex h-8 shrink-0 items-center gap-1.5 border-2 border-mad-black bg-mad-black px-2.5 text-xs font-medium text-mad-white hover:bg-mad-black/85 disabled:opacity-50"
          >
            {savingAll ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : onPhone ? (
              <Share2 className="size-3.5" aria-hidden />
            ) : (
              <Download className="size-3.5" aria-hidden />
            )}
            {savingAll
              ? `Getting ${savingAll.done} of ${savingAll.total} ready`
              : `${onPhone || useFolder ? "Save" : "Download"} ${selected.size > 0 ? `${toSave.length} selected` : `all ${toSave.length}`}${useFolder && folderName ? ` to ${folderName}` : ""}`}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading || syncing}
          title="Check the shop for new arrivals"
          aria-label="Check the shop for new arrivals"
          className="flex size-8 items-center justify-center border-2 border-mad-black/30 hover:border-mad-black disabled:opacity-40"
        >
          {loading || syncing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
        </button>
      </header>

      {collapsed ? null : (
        <div id="story-feed-body" className="border-t border-mad-black/15 px-3 pb-3 pt-2">
          <p className="mb-3 text-xs text-mad-black/65">
            Save each Story, post it from your phone, paste the shop link into a
            link sticker, then mark it shared. Tick the corner of the ones you want and
            Save them together. Shared Stories leave the row tomorrow; tap Show more
            at the end for the next ones.
          </p>
          {useFolder ? (
            <p className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-xs text-mad-black/65">
              <FolderOpen className="size-3.5" aria-hidden />
              {folderName ? (
                <>
                  Saving into <span className="font-medium text-mad-black">{folderName}</span>, a folder for each day.
                </>
              ) : (
                "Choose a folder inside Dropbox (open it, then Select Folder, then Edit files); Stories go straight in, a folder for each day."
              )}
              <button
                type="button"
                onClick={() =>
                  void chooseFolder()
                    .then((name) => {
                      if (name) setFolderName(name)
                    })
                    .catch((error) => toast.error(error instanceof Error ? error.message : "Couldn't open the folder."))
                }
                className="underline underline-offset-2 hover:text-mad-black"
              >
                {folderName ? "Change" : "Choose folder"}
              </button>
            </p>
          ) : null}

          {!loaded || (loading && feed.length === 0) ? (
            <div className="flex gap-3" aria-hidden>
              {Array.from({ length: compact ? 5 : 2 }).map((_, index) => (
                <div
                  key={index}
                  className={cn("aspect-[9/16] shrink-0 animate-pulse rounded-md", cardWidth)}
                  style={{ background: kit[index % kit.length]?.color, opacity: 0.35 }}
                />
              ))}
            </div>
          ) : feed.length === 0 ? (
            <p className="py-6 text-center text-sm text-mad-black/60">
              No new arrivals waiting. New stock from the shop shows up here.
            </p>
          ) : (
            <ul className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2">
              {feed.map((story) => {
                const id = story.row.marketingEntityId
                const shared = Boolean(sharedAt[id])
                const cutting = cuttingId === id
                const waiting = !story.cutoutUrl && !cutoutFailed[id]
                return (
                  <li key={id} className={cn("flex shrink-0 snap-center flex-col gap-2", cardWidth)}>
                    <div className="relative overflow-hidden rounded-md shadow-md">
                      {story.imageUrl ? (
                        <KitStoryCanvas
                          ref={(node) => {
                            nodes.current[id] = node
                          }}
                          background={story.background}
                          brandName={entityName}
                          {...storyCardWords(story)}
                          imageUrl={waiting ? null : story.imageUrl}
                          subject={story.subject}
                          showLinkGuide={!compact}
                        />
                      ) : null}
                      {waiting ? (
                        <div className="absolute inset-x-0 top-1/3 flex flex-col items-center gap-1 text-[11px]" style={{ color: story.background.text_color }}>
                          {cutting ? <Scissors className="size-4 animate-pulse" aria-hidden /> : <Loader2 className="size-4 animate-spin" aria-hidden />}
                          {cutting ? "Cutting out…" : "Waiting to cut out"}
                        </div>
                      ) : null}
                      {!shared && !waiting ? (
                        <button
                          type="button"
                          onClick={() => toggleSelected(id)}
                          aria-pressed={selected.has(id)}
                          title={selected.has(id) ? "Untick" : "Tick to save with others"}
                          aria-label={`${selected.has(id) ? "Untick" : "Tick"} ${story.designer} Story`}
                          className={cn(
                            "absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full border-2 shadow",
                            selected.has(id)
                              ? "border-white bg-mad-black text-white"
                              : "border-white/90 bg-black/25 text-transparent hover:bg-black/40"
                          )}
                        >
                          <Check className="size-4" aria-hidden />
                        </button>
                      ) : null}
                      {savedIds[id] && !shared ? (
                        <span className="pointer-events-none absolute bottom-2.5 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-mad-black shadow">
                          <Check className="size-3" aria-hidden /> {savedWord}
                        </span>
                      ) : null}
                      {shared ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
                          <span className="flex size-10 items-center justify-center rounded-full bg-white text-mad-black">
                            <Check className="size-5" aria-hidden />
                          </span>
                          <span className="font-typewriter text-xs uppercase tracking-widest">Shared</span>
                          <button
                            type="button"
                            onClick={() => void markShared(id, false)}
                            className="flex items-center gap-1 text-xs underline"
                          >
                            <Undo2 className="size-3" aria-hidden /> Undo
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <div className="flex gap-1" role="group" aria-label="Background">
                        {kit.map((bg) => (
                          <button
                            key={bg.id}
                            type="button"
                            onClick={() => patch(id, { backgroundId: bg.id })}
                            title={bg.name}
                            aria-label={`Use ${bg.name}`}
                            aria-pressed={bg.id === story.background.id}
                            className={cn(
                              "size-5 rounded-full border border-black/15",
                              bg.id === story.background.id && "ring-2 ring-mad-black ring-offset-1"
                            )}
                            style={{ background: bg.color }}
                          />
                        ))}
                      </div>
                      <Link
                        href={`/templates/wls-daily-story?eid=${encodeURIComponent(entityId)}&item=${encodeURIComponent(id)}`}
                        title="Edit the words, size and position"
                        aria-label={`Edit ${story.designer} Story`}
                        className="flex size-7 items-center justify-center border border-mad-black/30 hover:border-mad-black"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Link>
                    </div>

                    {cutoutFailed[id] && !story.cutoutUrl ? (
                      <button
                        type="button"
                        onClick={() => retryCutout(id)}
                        className="flex items-center gap-1 self-start text-[11px] text-mad-black/70 underline"
                      >
                        <Scissors className="size-3" aria-hidden /> Cutout failed, try again
                      </button>
                    ) : null}

                    <ol className="grid gap-1.5">
                      <li>
                        <button
                          type="button"
                          onClick={() => void onSave(story)}
                          disabled={savingId != null || waiting}
                          title={savedIds[id] ? (onPhone ? "Save it again" : "Download it again") : undefined}
                          className={cn(
                            "flex h-9 w-full items-center gap-2 px-3 text-xs font-medium disabled:opacity-40",
                            savedIds[id]
                              ? "border-2 border-emerald-700 bg-emerald-50 text-emerald-900"
                              : "bg-mad-black text-mad-white"
                          )}
                        >
                          <span className="font-typewriter opacity-60">1</span>
                          {savingId === id ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : savedIds[id] ? (
                            <Check className="size-3.5" aria-hidden />
                          ) : onPhone ? (
                            <Share2 className="size-3.5" aria-hidden />
                          ) : (
                            <Download className="size-3.5" aria-hidden />
                          )}
                          {savedIds[id]
                            ? savedWord
                            : onPhone
                              ? "Save image"
                              : useFolder
                                ? "Save to folder"
                                : "Download image"}
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => void copyStoryLink(story.row.destinationUrl)}
                          disabled={!story.row.destinationUrl}
                          className="flex h-9 w-full items-center gap-2 border-2 border-mad-black px-3 text-xs font-medium disabled:opacity-40"
                        >
                          <span className="font-typewriter opacity-60">2</span>
                          <Link2 className="size-3.5" aria-hidden />
                          Copy shop link
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => void markShared(id, !shared)}
                          aria-pressed={shared}
                          className={cn(
                            "flex h-9 w-full items-center gap-2 border-2 px-3 text-xs font-medium",
                            shared
                              ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                              : "border-mad-black/30 hover:border-mad-black"
                          )}
                        >
                          <span className="font-typewriter opacity-60">3</span>
                          <Check className="size-3.5" aria-hidden />
                          {shared ? "Shared" : "Mark shared"}
                        </button>
                      </li>
                    </ol>
                  </li>
                )
              })}
              {waiting.length > 0 ? (
                <li className={cn("flex shrink-0 snap-center", cardWidth)}>
                  <button
                    type="button"
                    onClick={showMore}
                    className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-mad-black/40 text-sm text-mad-black/70 hover:border-mad-black hover:text-mad-black"
                  >
                    <Plus className="size-6" aria-hidden />
                    Show {Math.min(MORE_SIZE, waiting.length)} more
                    <span className="text-xs text-mad-black/55">{waiting.length} waiting</span>
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
