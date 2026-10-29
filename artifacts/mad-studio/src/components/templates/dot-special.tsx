"use client"

import { forwardRef, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Check, FileText, Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"

import {
  Brush,
  EDITORIAL_SCRIPT,
  EDITORIAL_SERIF,
  gold,
  Rule,
} from "@/components/templates/editorial-announcement"
import { KIT_DISPLAY } from "@/components/templates/kit-type"
import { Button } from "@/components/ui/button"
import type { StoryBackground } from "@/lib/brands/story-kit"
import { WORN_LABEL_TAG_COLORS } from "@/lib/social-creative/worn-label-promo-theme"
import { uploadRenderedPng } from "@/lib/studio/final-artwork"
import { saveStudioSlidesHandoff, STUDIO_SLIDES_QUERY_FLAG } from "@/lib/studio/studio-slides-handoff"
import { bakeStoryPng, shareOrDownloadStory } from "@/lib/templates/use-kit-stories"
import { useRememberedState } from "@/lib/use-remembered-state"
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

const WHEN_PRESETS = ["This weekend only", "This week only", "Today only"]

/** A4 at 96dpi; exported at 2x for print. */
const A4_WIDTH = 794
const A4_HEIGHT = 1123

/** The white in-store sheet, drawn with the same layout as the kit cards. */
export function printBackground(kit: StoryBackground[]): StoryBackground {
  return { ...kit[0], id: "print_white", name: "White", color: "#FFFFFF", text_color: "#252525", accent_color: "#94733F" }
}

function colourLabel(name: WornLabelTagColorName): string {
  return name.charAt(0) + name.slice(1).toLowerCase()
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
  const spaced = (size: number) => ({
    margin: 0,
    fontFamily: EDITORIAL_SERIF,
    textTransform: "uppercase" as const,
    fontSize: `${size}cqw`,
    letterSpacing: "0.32em",
  })
  // A dark dot on a dark background (or white on white) needs a ring to show.
  const ring = dot.hex.toLowerCase() === "#111111" || background.color.toLowerCase() === dot.hex.toLowerCase()

  return (
    <div
      ref={ref}
      className={className}
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
        <p
          style={{
            margin: 0,
            fontFamily: EDITORIAL_SERIF,
            textTransform: "uppercase",
            fontWeight: 500,
            fontSize: `${(story ? 20 : a4 ? 18 : 15) * Math.min(1, 8 / Math.max(special.discount.length, 1))}cqw`,
            lineHeight: 0.95,
            letterSpacing: "-0.01em",
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
              fontSize: `${story ? 10 : a4 ? 9 : 7.5}cqw`,
              lineHeight: 1.05,
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

/** Colour dot special editor: kit Story and feed card, plus the white A4 sheet for the shop. */
export function DotSpecialPanel({
  entityId,
  entityName,
  kit,
}: {
  entityId: string
  entityName: string
  kit: StoryBackground[]
}) {
  const [, navigate] = useLocation()
  const [special, setSpecial] = useRememberedState<DotSpecial>(`mad.dotSpecial.${entityId}`, DEFAULT_SPECIAL)
  const [backgroundId, setBackgroundId] = useRememberedState<string | null>(`mad.dotSpecial.${entityId}.background`, "charcoal")
  const [busy, setBusy] = useState<"story" | "studio" | "print" | null>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const background = kit.find((bg) => bg.id === backgroundId) ?? kit[0]
  const white = useMemo(() => printBackground(kit), [kit])
  const field = "h-9 w-full border-2 border-mad-black bg-white px-2 text-sm"

  // Opened from a campaign step (#dot-special): bring it into view.
  useEffect(() => {
    if (window.location.hash !== "#dot-special") return
    const timer = window.setTimeout(() => document.getElementById("dot-special")?.scrollIntoView({ behavior: "smooth" }), 300)
    return () => window.clearTimeout(timer)
  }, [])

  function set<K extends keyof DotSpecial>(key: K, value: DotSpecial[K]) {
    setSpecial((current) => ({ ...current, [key]: value }))
  }

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
    })

  const sendCard = () =>
    run("studio", async () => {
      if (!cardRef.current) return
      const { blob } = await bakeStoryPng(cardRef.current)
      const url = await uploadRenderedPng(blob, entityId)
      const caption = [
        `${colourLabel(special.color)} dot: ${special.discount}. ${special.when}.`.replace(/\.\./g, "."),
        "",
        "Look for the coloured dot on the tag.",
        special.footer,
      ].join("\n").trim()
      saveStudioSlidesHandoff(entityId, { urls: [url], caption })
      navigate(`/studio?eid=${encodeURIComponent(entityId)}&${STUDIO_SLIDES_QUERY_FLAG}=1`)
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

        <div className="flex flex-wrap items-start gap-5">
          <div className="flex w-[200px] flex-col gap-2">
            <DotSpecialArt ref={storyRef} special={special} background={background} brandName={entityName} aspect="story" className="rounded-md shadow-md" />
            <Button type="button" className="border-2 border-mad-black bg-mad-black text-mad-white" disabled={busy != null} onClick={() => void saveStory()}>
              {busy === "story" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Share2 className="mr-2 size-4" />}
              Save Story image
            </Button>
          </div>
          <div className="flex w-[240px] flex-col gap-2">
            <DotSpecialArt ref={cardRef} special={special} background={background} brandName={entityName} aspect="card" className="rounded-sm shadow-md" />
            <Button type="button" variant="outline" className="border-2 border-mad-black" disabled={busy != null} onClick={() => void sendCard()}>
              {busy === "studio" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
              Send card to Studio
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
