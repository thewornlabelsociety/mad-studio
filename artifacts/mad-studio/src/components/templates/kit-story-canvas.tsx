import { forwardRef, type CSSProperties } from "react"

import type { StoryBackground } from "@/lib/brands/story-kit"

const DISPLAY = "'Josefin Sans', 'Century Gothic', Futura, system-ui, sans-serif"

type Props = {
  background: StoryBackground
  /** Brand name; the last word sits on its own spaced-out line. */
  brandName: string
  /** Top-right label, e.g. NEW IN. */
  tag: string
  imageUrl: string | null
  vibe: string
  designer: string
  sizeLabel: string | null
  /** 0.7–1.3 */
  subjectScale?: number
  /** Percent of the frame height, negative moves up. */
  subjectOffsetY?: number
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
    subjectScale = 1,
    subjectOffsetY = 0,
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
        <p style={{ ...caps, fontSize: "4cqw", letterSpacing: "0.24em", color: accent, paddingTop: "0.4cqw" }}>
          {tag}
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          left: "10%",
          right: "10%",
          top: `${15 + subjectOffsetY}%`,
          height: "43%",
          display: "grid",
          placeItems: "center",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `scale(${subjectScale})`,
              filter: "drop-shadow(0 4cqw 4cqw rgba(0,0,0,0.28))",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: "6cqw",
          right: "6cqw",
          // Sits on top of the link-sticker zone and grows upward.
          bottom: "23cqw",
          display: "grid",
          gap: "2.4cqw",
        }}
      >
        <p
          style={{
            ...caps,
            fontWeight: 700,
            fontSize: vibe.length > 16 ? "8.6cqw" : "10.5cqw",
            lineHeight: 1,
            letterSpacing: "0.06em",
            overflowWrap: "anywhere",
          }}
        >
          {vibe}
        </p>
        <p
          style={{
            ...caps,
            fontSize: designer.length > 16 ? "4.8cqw" : "6cqw",
            letterSpacing: designer.length > 16 ? "0.14em" : "0.22em",
          }}
        >
          {designer}
        </p>
        {sizeLabel ? (
          <p
            style={{
              ...caps,
              justifySelf: "start",
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
