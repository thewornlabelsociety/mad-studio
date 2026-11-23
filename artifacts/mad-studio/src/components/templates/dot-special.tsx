"use client"

import { forwardRef, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { ArrowRight, CalendarPlus, Check, FileText, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"

import {
  Brush,
  EDITORIAL_SCRIPT,
  EDITORIAL_SCRIPT_SCALE,
  EDITORIAL_SCRIPT_WEIGHT,
  gold,
  Rule,
  scaled,
} from "@/components/templates/editorial-announcement"
import { KIT_DISPLAY, KIT_DISPLAY_SCALE } from "@/components/templates/kit-type"
import { Button } from "@/components/ui/button"
import type { StoryBackground } from "@/lib/brands/story-kit"
import { WORN_LABEL_TAG_COLORS } from "@/lib/social-creative/worn-label-promo-theme"
import { completeActiveStep } from "@/lib/planner/campaign-progress"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { useSlidesOut } from "@/components/planner/day-draft-target"
import { bakeStoryFrames } from "@/components/planner/finish-panel"
import { bakeStoryPng, shareOrDownloadStory } from "@/lib/templates/use-kit-stories"
import { useBrandSetting } from "@/lib/use-brand-setting"
import { cn } from "@/lib/utils"
import type { WornLabelTagColorName } from "@/types/social-creative"

export type DotSpecial = {
  color: WornLabelTagColorName
  discount: string
  when: string
  /** Script line, e.g. "because the best wardrobes aren't new". */
  line: string
  footer: string
}

const DEFAULT_SPECIAL: DotSpecial = {
  color: "PURPLE",
  discount: "50% off",
  when: "This weekend only",
  line: "because the best wardrobes aren't new",
  footer: "In-store & online · Whangārei",
}

/** The brand's current dot special, kept on this device and shared by every screen that shows it. */
export function useDotSpecial(entityId: string) {
  return useBrandSetting<DotSpecial>(entityId, "dot_special", `mad.dotSpecial.${entityId}`, DEFAULT_SPECIAL)
}

const DEFAULT_SECOND_SPECIAL: DotSpecial = {
  color: "PINK",
  discount: "50% off",
  when: "This week only",
  line: "",
  footer: "In-store & online · Whangārei",
}

/** The week's second dot (e.g. pink 50% off), kept with the brand. Off until switched on. */
export function useSecondDotSpecial(entityId: string) {
  return useBrandSetting<DotSpecial & { on: boolean }>(entityId, "dot_special_second", `mad.dotSpecial2.${entityId}`, {
    ...DEFAULT_SECOND_SPECIAL,
    on: false,
  })
}

const WHEN_PRESETS = ["This weekend only", "This week only", "Today only"]

/** A4 at 96dpi; exported at 2x for print. */
const A4_WIDTH = 794
const A4_HEIGHT = 1123

/** The white in-store sheet, drawn with the same layout as the kit cards. */
export function printBackground(kit: StoryBackground[]): StoryBackground {
  return { ...kit[0], id: "print_white", name: "White", color: "#FFFFFF", text_color: "#252525", accent_color: "#94733F" }
}

export function colourLabel(name: WornLabelTagColorName): string {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

/** The discount's size in cqw: `max` for short ones, smaller so a long one stays inside the 86cqw column. */
function discountSize(discount: string, max: number): number {
  // About 0.78em per bold capital with its tracking.
  return Math.min(max, 84 / (Math.max(discount.length, 1) * 0.78))
}

/**
 * The dot special in the brand kit: brand line, the tag-coloured dot, the
 * discount in the tall serif, a gold brush, then when and where.
 */
export const DotSpecialArt = forwardRef<
  HTMLDivElement,
  { special: DotSpecial; background: StoryBackground; brandName: string; aspect: "story" | "card" | "a4"; className?: string }
>(function DotSpecialArt({ special, background, brandName, aspect, className }, ref) {
  const ink = background.text_color
  const accent = gold(background)
  const dot = WORN_LABEL_TAG_COLORS[special.color]
  const story = aspect === "story"
  const a4 = aspect === "a4"
  // Small spaced lines in the kit's display capitals: the hairline serif vanished at this size.
  const spaced = (size: number) => ({
    margin: 0,
    fontFamily: KIT_DISPLAY,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    fontSize: `${size}cqw`,
    letterSpacing: "0.24em",
  })
  // A dark dot on a dark background (or white on white) needs a ring to show.
  const ring = dot.hex.toLowerCase() === "#111111" || background.color.toLowerCase() === dot.hex.toLowerCase()

  return (
    <div
      ref={ref}
      className={className}
      // Read when the Story is saved as a draft, so the draft can be edited with the same background.
      data-background-id={background.id}
      style={{
        position: "relative",
        width: a4 ? A4_WIDTH : "100%",
        height: a4 ? A4_HEIGHT : undefined,
        aspectRatio: a4 ? undefined : story ? "9 / 16" : "4 / 5",
        overflow: "hidden",
        background: background.color,
        color: ink,
        containerType: "inline-size",
      }}
    >
      <div style={{ position: "absolute", top: story ? "7cqw" : "6cqw", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "2.4cqw" }}>
        <p style={{ margin: 0, fontFamily: KIT_DISPLAY, textTransform: "uppercase", fontWeight: 600, fontSize: story ? "2.6cqw" : "2.2cqw", letterSpacing: "0.24em" }}>
          {brandName}
        </p>
        <Rule color={ink} />
      </div>

      <div
        style={{
          position: "absolute",
          left: "7cqw",
          right: "7cqw",
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: story ? "4.2cqw" : a4 ? "3.6cqw" : "2.8cqw",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "block",
            width: story ? "30cqw" : a4 ? "34cqw" : "22cqw",
            aspectRatio: "1",
            borderRadius: "50%",
            background: dot.hex,
            boxShadow: ring ? `0 0 0 0.6cqw ${background.color}, 0 0 0 0.9cqw ${ink}` : undefined,
          }}
        />
        <p style={spaced(story ? 3.4 : a4 ? 3.2 : 2.8)}>{colourLabel(special.color)} dot</p>
        {/* Bold kit sans, not the hairline serif: it has to read on the white A4 sheet too. */}
        <p
          style={{
            margin: 0,
            fontFamily: KIT_DISPLAY,
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: scaled(discountSize(special.discount || "50% off", story ? 17 : a4 ? 15 : 13), KIT_DISPLAY_SCALE),
            lineHeight: 0.95,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {special.discount || "50% off"}
        </p>
        <Brush color={accent} />
        {special.when.trim() ? <p style={spaced(story ? 3.2 : a4 ? 3 : 2.6)}>{special.when}</p> : null}
        {special.line.trim() ? (
          <p
            style={{
              margin: "1cqw 0 0",
              fontFamily: EDITORIAL_SCRIPT,
              fontWeight: EDITORIAL_SCRIPT_WEIGHT,
              fontSize: scaled(story ? 10 : a4 ? 9 : 7.5, EDITORIAL_SCRIPT_SCALE),
              lineHeight: 1.15,
              color: accent,
              transform: "rotate(-4deg)",
            }}
          >
            {special.line}
          </p>
        ) : null}
      </div>

      <div style={{ position: "absolute", bottom: story ? "8cqw" : "6cqw", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "2.4cqw" }}>
        {special.footer.trim() ? <p style={spaced(story ? 2.6 : 2.2)}>{special.footer}</p> : null}
        <Rule color={ink} width={12} />
      </div>
    </div>
  )
})

/** The caption that goes with the dot special card or Story. */
export function dotSpecialCaption(special: DotSpecial): string {
  return [
    `${colourLabel(special.color)} dot: ${special.discount}. ${special.when}.`.replace(/\.\./g, "."),
    "",
    "Look for the coloured dot on the tag.",
    special.footer,
  ]
    .join("\n")
    .trim()
}

/** The dot special's wording: dot colour, discount, when, script line and bottom line. */
export function DotSpecialFields({
  special,
  onChange,
}: {
  special: DotSpecial
  onChange: Dispatch<SetStateAction<DotSpecial>>
}) {
  const field = "h-9 w-full border-2 border-mad-black bg-white px-2 text-sm"

  function set<K extends keyof DotSpecial>(key: K, value: DotSpecial[K]) {
    onChange((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="grid content-start gap-3">
      <div className="grid gap-1 text-xs">
        <span className="font-typewriter uppercase tracking-widest">Dot colour</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dot colour">
          {(Object.keys(WORN_LABEL_TAG_COLORS) as WornLabelTagColorName[]).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => set("color", name)}
              title={colourLabel(name)}
              aria-label={`${colourLabel(name)} dot`}
              aria-pressed={special.color === name}
              className={cn(
                "size-8 rounded-full border border-black/20",
                special.color === name && "ring-2 ring-mad-black ring-offset-2"
              )}
              style={{ background: WORN_LABEL_TAG_COLORS[name].hex }}
            />
          ))}
        </div>
      </div>
      <label className="grid gap-1 text-xs">
        <span className="font-typewriter uppercase tracking-widest">Discount</span>
        <input id="dot-discount" className={field} value={special.discount} maxLength={14} onChange={(e) => set("discount", e.target.value)} />
      </label>
      <label className="grid gap-1 text-xs">
        <span className="font-typewriter uppercase tracking-widest">When</span>
        <input id="dot-when" className={field} value={special.when} maxLength={32} onChange={(e) => set("when", e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {WHEN_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => set("when", preset)}
            className="border border-mad-black/30 px-2.5 py-1 text-xs hover:border-mad-black"
          >
            {preset}
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-xs">
        <span className="font-typewriter uppercase tracking-widest">Script line (optional)</span>
        <input id="dot-line" className={field} value={special.line} maxLength={48} onChange={(e) => set("line", e.target.value)} />
      </label>
      <label className="grid gap-1 text-xs">
        <span className="font-typewriter uppercase tracking-widest">Bottom line</span>
        <input id="dot-footer" className={field} value={special.footer} maxLength={40} onChange={(e) => set("footer", e.target.value)} />
      </label>
    </div>
  )
}

/** Colour dot special editor: kit Story and feed card, plus the white A4 sheet for the shop. */
export function DotSpecialPanel({
  entityId,
  entityName,
  kit,
  ready = true,
  onStoryNode,
  draft,
}: {
  entityId: string
  entityName: string
  kit: StoryBackground[]
  /** False while content above is still loading; the #dot-special jump waits for it. */
  ready?: boolean
  /** The rendered Story, for screens that save it as a draft. */
  onStoryNode?: (node: HTMLDivElement | null) => void
  /** A "Draft for <day>" button beside the Story, from the screen that can draft. */
  draft?: { label: string; busy: boolean; disabled: boolean; onClick: () => void }
}) {
  // The feed card goes through the same finish panel as every other post.
  const out = useSlidesOut(entityId)
  // Two dots a week (e.g. purple 25% off, pink 50% off); the editor shows one at a time.
  const [firstSpecial, setFirstSpecial] = useDotSpecial(entityId)
  const [second, setSecond] = useSecondDotSpecial(entityId)
  const [which, setWhich] = useState<"first" | "second">("first")
  const special: DotSpecial = which === "second" ? second : firstSpecial
  const setSpecial: Dispatch<SetStateAction<DotSpecial>> =
    which === "second"
      ? (action) =>
          setSecond((current) => ({ ...(typeof action === "function" ? action(current) : action), on: current.on }))
      : setFirstSpecial
  const [backgroundId, setBackgroundId] = useBrandSetting<string | null>(
    entityId,
    "dot_special_background",
    `mad.dotSpecial.${entityId}.background`,
    "charcoal"
  )
  const [busy, setBusy] = useState<"story" | "studio" | "print" | null>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const white = useMemo(() => printBackground(kit), [kit])

  // Opened from the planner or a campaign step (#dot-special): bring it into view
  // once whatever sits above it has loaded, or it gets pushed back down.
  const jumped = useRef(false)
  useEffect(() => {
    if (!ready || jumped.current || window.location.hash !== "#dot-special") return
    jumped.current = true
    const timer = window.setTimeout(() => document.getElementById("dot-special")?.scrollIntoView({ behavior: "smooth" }), 300)
    return () => window.clearTimeout(timer)
  }, [ready])

  async function run(kind: "story" | "studio" | "print", work: () => Promise<void>) {
    setBusy(kind)
    try {
      await work()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.")
    } finally {
      setBusy(null)
    }
  }

  const saveStory = () =>
    run("story", async () => {
      if (!storyRef.current) return
      const baked = await bakeStoryPng(storyRef.current)
      const result = await shareOrDownloadStory({ ...baked, filename: `wls-${special.color.toLowerCase()}-dot.png` })
      if (result === "downloaded") toast.success("Story image saved.")
      if (result !== "cancelled") void completeActiveStep(entityId)
    })

  const sendCard = () =>
    run("studio", async () => {
      if (!cardRef.current) return
      const { blob } = await bakeStoryPng(cardRef.current)
      const url = await uploadRenderedPng(blob, entityId)
      await out.sendOut({
        urls: [url],
        caption: dotSpecialCaption(special),
        title: "Dot special card",
        kind: "dot_special_card",
        story: () => bakeStoryFrames([storyRef.current], entityId),
      })
    })

  const downloadPrint = () =>
    run("print", async () => {
      if (!printRef.current) return
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(printRef.current, {
        includeQueryParams: true,
        cacheBust: true,
        pixelRatio: 2,
        width: A4_WIDTH,
        height: A4_HEIGHT,
      })
      const { jsPDF } = await import("jspdf")
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297)
      pdf.save(`WLS-${special.color}-dot-A4.pdf`)
      toast.success("A4 sheet downloaded. Print it on white paper.")
      void completeActiveStep(entityId)
    })

  return (
    <section id="dot-special" aria-labelledby="dot-special-heading" className="grid scroll-mt-4 gap-4 border-t-2 border-mad-black pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="dot-special-heading" className="brand-typewriter text-lg">
            Colour dot special
          </h2>
          <p className="mt-1 max-w-xl text-sm text-mad-black/70">
            A Story, a feed card and a white A4 sheet for the shop, all for the same dot.
          </p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Background">
          {kit.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => setBackgroundId(bg.id)}
              title={bg.name}
              aria-label={`Use ${bg.name}`}
              aria-pressed={bg.id === background.id}
              className={cn("relative size-7 rounded-full border border-black/15", bg.id === background.id && "ring-2 ring-mad-black ring-offset-2")}
              style={{ background: bg.color }}
            >
              {bg.id === background.id ? <Check className="absolute inset-0 m-auto size-3" style={{ color: bg.text_color }} aria-hidden /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Which dot">
            {(
              [
                { id: "first", label: "First dot", dot: firstSpecial },
                { id: "second", label: "Second dot", dot: second },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setWhich(option.id)}
                aria-pressed={which === option.id}
                className={cn(
                  "flex h-9 items-center gap-2 border-2 border-mad-black px-2.5 text-xs",
                  which === option.id ? "bg-mad-black text-mad-white" : "hover:bg-[#F4EFE6]",
                  option.id === "second" && !second.on && "border-dashed opacity-70"
                )}
              >
                <span
                  aria-hidden
                  className="size-3.5 rounded-full border border-black/20"
                  style={{ background: WORN_LABEL_TAG_COLORS[option.dot.color].hex }}
                />
                {option.label} · {option.dot.discount}
              </button>
            ))}
          </div>
          {which === "second" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                id="dot-second-on"
                type="checkbox"
                checked={second.on}
                onChange={(event) => setSecond((current) => ({ ...current, on: event.target.checked }))}
              />
              Running a second dot this week
            </label>
          ) : null}
          <DotSpecialFields special={special} onChange={setSpecial} />
        </div>

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex w-[200px] flex-col gap-2">
            <DotSpecialArt
              ref={(node) => {
                storyRef.current = node
                onStoryNode?.(node)
              }}
              special={special} background={background} brandName={entityName} aspect="story" className="rounded-md shadow-md" />
            <Button type="button" className="border-2 border-mad-black bg-mad-black text-mad-white" disabled={busy != null} onClick={() => void saveStory()}>
              {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
              Save Story image
            </Button>
            {draft ? (
              <Button
                type="button"
                variant="outline"
                className="border-2 border-mad-black"
                disabled={busy != null || draft.disabled || draft.busy}
                onClick={draft.onClick}
                title="Put this Story and the carousel on the day to approve, replacing the drafts there"
              >
                {draft.busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CalendarPlus className="mr-2 size-4" />}
                {draft.busy ? "Drafting…" : draft.label}
              </Button>
            ) : null}
          </div>
          <div className="flex w-[240px] flex-col gap-2">
            <DotSpecialArt ref={cardRef} special={special} background={background} brandName={entityName} aspect="card" className="rounded-sm shadow-md" />
            <Button type="button" variant="outline" className="border-2 border-mad-black" disabled={busy != null} onClick={() => void sendCard()}>
              {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
              {out.cardLabel}
            </Button>
          </div>
          <div className="flex w-[212px] flex-col gap-2">
            {/* The A4 sheet drawn at full size, shown scaled down. */}
            <div className="relative overflow-hidden border border-black/15 shadow-md" style={{ width: 212, height: 300 }}>
              <div style={{ transform: `scale(${212 / A4_WIDTH})`, transformOrigin: "top left" }}>
                <DotSpecialArt ref={printRef} special={special} background={white} brandName={entityName} aspect="a4" />
              </div>
            </div>
            <Button type="button" variant="outline" className="border-2 border-mad-black" disabled={busy != null} onClick={() => void downloadPrint()}>
              {busy === "print" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />}
              A4 sheet for the shop
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
