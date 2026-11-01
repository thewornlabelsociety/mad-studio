import { forwardRef, type CSSProperties } from "react"

import { AdjustableLayer, NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import type { StoryBackground } from "@/lib/brands/story-kit"

const DISPLAY = "'Josefin Sans', 'Century Gothic', Futura, system-ui, sans-serif"

type Props = {
  background: StoryBackground
  /** Brand name; the last word sits on its own spaced-out line. */
  brandName: string
  /** Top-right label, e.g. NEW IN. Null leaves it off. */
  tag: string | null
  imageUrl: string | null
  /** Null or empty leaves the line off. */
  vibe: string | null
  designer: string | null
  sizeLabel: string | null
  /** e.g. SILK: a second pill beside the size. */
  fabricLabel?: string | null
  /** Hand placement of the cutout. */
  subject?: LayerAdjust
  /** Given, the cutout can be dragged, resized and tilted. */
  onSubjectChange?: (next: LayerAdjust) => void
  subjectSelected?: boolean
  onSubjectSelect?: (selected: boolean) => void
  /** Sale Stories: the old price struck through, then the new one. */
  priceLine?: { was: string; now: string } | null
  /** Dashed link-sticker zone; never baked into the export. */
  showLinkGuide?: boolean
  className?: string
}

function splitWordmark(name: string): [string, string] {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean)
  if (words.length < 2) return [words[0] ?? "", ""]
  return [words.slice(0, -1).join(" "), words[words.length - 1]]
}

/**
 * The locked new-arrival Story: wordmark and tag across the top, the cutout in
 * the middle, then vibe, designer and size in capitals. Only the background
 * (and its paired text and accent colours) changes between Stories.
 */
export const KitStoryCanvas = forwardRef<HTMLDivElement, Props>(function KitStoryCanvas(
  {
    background,
    brandName,
    tag,
    imageUrl,
    vibe,
    designer,
    sizeLabel,
    fabricLabel = null,
    subject = NO_ADJUST,
    onSubjectChange,
    subjectSelected = false,
    onSubjectSelect,
    priceLine = null,
    showLinkGuide = true,
    className,
  },
  ref
) {
  const [markTop, markBottom] = splitWordmark(brandName)
  const fg = background.text_color
  const accent = background.accent_color
  const caps: CSSProperties = { fontFamily: DISPLAY, textTransform: "uppercase", margin: 0 }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "relative",
        aspectRatio: "9 / 16",
        width: "100%",
        overflow: "hidden",
        background: background.color,
        color: fg,
        containerType: "inline-size",
      }}
      onPointerDown={onSubjectChange ? () => onSubjectSelect?.(false) : undefined}
    >
      <div
        style={{
          position: "absolute",
          inset: "5.5cqw 6cqw auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <p style={{ ...caps, fontWeight: 600, fontSize: "5.6cqw", letterSpacing: "0.2em", lineHeight: 1.1 }}>
          {markTop}
          {markBottom ? (
            <span
              style={{
                display: "block",
                fontSize: "3.4cqw",
                letterSpacing: "0.5em",
                fontWeight: 400,
                color: accent,
              }}
            >
              {markBottom}
            </span>
          ) : null}
        </p>
        {tag ? (
          <p style={{ ...caps, fontSize: "4cqw", letterSpacing: "0.24em", color: accent, paddingTop: "0.4cqw" }}>
            {tag}
          </p>
        ) : null}
      </div>

      {/* Item and words share the space between the header and the link
          sticker: longer words take room from the item, never overlap it. */}
      <div
        style={{
          position: "absolute",
          left: "6cqw",
          right: "6cqw",
          top: "15%",
          bottom: "23cqw",
          display: "flex",
          flexDirection: "column",
          gap: "4cqw",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 0", minHeight: 0, margin: "0 4cqw" }}>
          {imageUrl ? (
            <AdjustableLayer
              base={{ left: 0, top: 0, width: 100, height: 100 }}
              adjust={subject}
              zIndex={1}
              editable={Boolean(onSubjectChange)}
              selected={subjectSelected}
              label="Item"
              onSelect={() => onSubjectSelect?.(true)}
              onChange={onSubjectChange}
            >
              {/* Keyed so a new item never shows the last one's photo while it loads. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={imageUrl}
                src={imageUrl}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  filter: "drop-shadow(0 4cqw 4cqw rgba(0,0,0,0.28))",
                }}
              />
            </AdjustableLayer>
          ) : null}
        </div>

      <div style={{ display: "grid", gap: "2.4cqw" }}>
        {/* Prominent but secondary: the item is the hero. */}
        {vibe ? (
          <p
            style={{
              ...caps,
              fontWeight: 700,
              fontSize: vibe.length > 16 ? "6.4cqw" : "7.6cqw",
              lineHeight: 1.05,
              letterSpacing: "0.08em",
              overflowWrap: "anywhere",
            }}
          >
            {vibe}
          </p>
        ) : null}
        {designer ? (
          <p
            style={{
              ...caps,
              fontSize: designer.length > 16 ? "4.4cqw" : "5.4cqw",
              letterSpacing: designer.length > 16 ? "0.14em" : "0.22em",
              overflowWrap: "anywhere",
            }}
          >
            {designer}
          </p>
        ) : null}
        {sizeLabel || fabricLabel || priceLine ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: "3.6cqw", flexWrap: "wrap" }}>
            {sizeLabel ? (
              <p
                style={{
                  ...caps,
                  fontWeight: 600,
                  fontSize: "4.4cqw",
                  letterSpacing: "0.2em",
                  padding: "1.6cqw 3.2cqw 1.2cqw",
                  border: "0.5cqw solid currentColor",
                  borderRadius: 999,
                }}
              >
                {sizeLabel}
              </p>
            ) : null}
            {fabricLabel ? (
              <p
                style={{
                  ...caps,
                  fontWeight: 600,
                  fontSize: "4.4cqw",
                  letterSpacing: "0.2em",
                  padding: "1.6cqw 3.2cqw 1.2cqw",
                  border: "0.5cqw solid currentColor",
                  borderRadius: 999,
                }}
              >
                {fabricLabel}
              </p>
            ) : null}
            {priceLine ? (
              <>
                <p style={{ ...caps, fontSize: "4.6cqw", letterSpacing: "0.12em", textDecoration: "line-through", opacity: 0.6 }}>
                  {priceLine.was}
                </p>
                <p style={{ ...caps, fontWeight: 700, fontSize: "6.6cqw", letterSpacing: "0.06em", color: accent }}>
                  {priceLine.now}
                </p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>

      {showLinkGuide ? (
        <div
          data-export-ignore="true"
          style={{
            ...caps,
            position: "absolute",
            left: "19%",
            right: "19%",
            bottom: "7cqw",
            padding: "3cqw 0 2.6cqw",
            border: `0.5cqw dashed ${fg}`,
            borderRadius: "3cqw",
            opacity: 0.55,
            textAlign: "center",
            fontSize: "3.6cqw",
            letterSpacing: "0.12em",
          }}
        >
          Link sticker
        </div>
      ) : null}
    </div>
  )
})
