import type { CSSProperties } from "react"

import type { Announcement } from "@/components/templates/announcement-slides"
import { KIT_DISPLAY } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

/** The moodboard's tall serif, signature script and spaced small caps. */
export const EDITORIAL_SERIF = "'Bodoni Moda', Didot, 'Times New Roman', serif"
export const EDITORIAL_SCRIPT = "'Mrs Saint Delafield', 'Brush Script MT', cursive"

export type EditorialAccent = "none" | "brush" | "oval" | "arrow"

/** Gold for the brush and script: deeper on light backgrounds, cream on mid-tones. */
export function gold(background: StoryBackground): string {
  const hex = background.color.replace("#", "")
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b
  if (light > 0.6) return "#94733F"
  if (light > 0.45) return "#F1EADB"
  return "#CBA977"
}

function lines(text: string): string[] {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Headline size in cqw so the longest line fits the width. */
function serifSize(headline: string, story: boolean): number {
  const rows = lines(headline)
  const longest = Math.max(...rows.map((row) => row.length), 1)
  const fit = 84 / (longest * 0.66)
  const cap = story ? 24 : 19
  const byRows = rows.length > 4 ? 0.72 : rows.length > 3 ? 0.86 : 1
  return Math.min(cap * byRows, fit)
}

function scriptSize(text: string, story: boolean): number {
  const rows = lines(text)
  const longest = Math.max(...rows.map((row) => row.length), 1)
  const fit = 90 / (longest * 0.3)
  return Math.min(story ? 26 : 21, fit)
}

const smallCaps: CSSProperties = {
  margin: 0,
  fontFamily: EDITORIAL_SERIF,
  textTransform: "uppercase",
  fontWeight: 400,
}

export function Rule({ color, width = 14 }: { color: string; width?: number }) {
  return <span style={{ display: "block", width: `${width}cqw`, height: "0.25cqw", background: color, opacity: 0.8 }} />
}

export function Brush({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 200 18" style={{ width: "34cqw", height: "auto", display: "block" }} aria-hidden>
      <path
        d="M4 13 C 50 6, 110 4, 196 5 C 140 8, 80 11, 10 16 Z"
        fill={color}
        opacity={0.9}
      />
    </svg>
  )
}

function ArrowCircle({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 40" style={{ width: "8cqw", height: "8cqw", display: "block" }} aria-hidden>
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={color} strokeWidth="1.2" />
      <path d="M12 20 H27 M22 15 L27 20 L22 25" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The editorial announcement from the brand moodboard: brand line and rule,
 * a tall serif (or script) headline, optional script line, spaced detail
 * lines and a gold brush, oval or arrow.
 */
export function EditorialAnnouncement({
  background,
  brandName,
  announcement,
  story,
  linkSpace,
}: {
  background: StoryBackground
  brandName: string
  announcement: Announcement
  story: boolean
  linkSpace?: boolean
}) {
  const ink = background.text_color
  const accent = gold(background)
  const align = announcement.align ?? "center"
  const scriptHeadline = announcement.headlineFont === "script"
  const headline = announcement.headline.trim() || "Your headline"
  const details = announcement.details.map((line) => line.trim()).filter(Boolean)
  const kicker = lines(announcement.kicker)
  const script = announcement.script?.trim() ?? ""
  const accentKind = announcement.accent ?? "brush"
  const textAlign = align === "left" ? "left" : "center"
  const itemsAlign = align === "left" ? "flex-start" : "center"

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: story ? "7cqw" : "6cqw",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2.4cqw",
        }}
      >
        <p style={{ margin: 0, fontFamily: KIT_DISPLAY, textTransform: "uppercase", fontWeight: 600, fontSize: story ? "2.6cqw" : "2.2cqw", letterSpacing: "0.24em" }}>
          {brandName}
        </p>
        <Rule color={ink} />
      </div>

      <div
        style={{
          position: "absolute",
          left: align === "left" ? "9cqw" : "7cqw",
          right: "7cqw",
          top: "50%",
          transform: story && linkSpace ? "translateY(-56%)" : "translateY(-48%)",
          display: "flex",
          flexDirection: "column",
          alignItems: itemsAlign,
          textAlign,
          gap: story ? "4.4cqw" : "3.2cqw",
        }}
      >
        {kicker.length > 0 ? (
          <div style={{ display: "grid", gap: "1cqw" }}>
            {kicker.map((line) => (
              <p key={line} style={{ ...smallCaps, fontSize: story ? "3.2cqw" : "2.6cqw", letterSpacing: "0.32em" }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}

        <p
          style={
            scriptHeadline
              ? {
                  margin: 0,
                  fontFamily: EDITORIAL_SCRIPT,
                  fontSize: `${scriptSize(headline, story)}cqw`,
                  lineHeight: 1.05,
                  color: accent,
                  whiteSpace: "pre-line",
                  transform: "rotate(-6deg)",
                }
              : {
                  ...smallCaps,
                  fontWeight: 500,
                  fontSize: `${serifSize(headline, story)}cqw`,
                  lineHeight: 0.98,
                  letterSpacing: "-0.01em",
                  whiteSpace: "pre-line",
                }
          }
        >
          {headline}
        </p>

        {script ? (
          <p
            style={{
              margin: "-1cqw 0 0",
              fontFamily: EDITORIAL_SCRIPT,
              fontSize: `${scriptSize(script, story) * 0.9}cqw`,
              lineHeight: 1,
              color: accent,
              whiteSpace: "pre-line",
              transform: "rotate(-6deg)",
            }}
          >
            {script}
          </p>
        ) : null}

        {accentKind === "brush" ? <Brush color={accent} /> : null}

        {details.length > 0 ? (
          <div
            style={{
              display: "grid",
              gap: story ? "1.6cqw" : "1.2cqw",
              justifyItems: itemsAlign,
              ...(accentKind === "oval"
                ? {
                    padding: story ? "5cqw 9cqw" : "4cqw 8cqw",
                    border: `0.3cqw solid ${ink}`,
                    borderRadius: "50%",
                    transform: "rotate(-4deg)",
                  }
                : null),
            }}
          >
            {details.map((line) => (
              <p key={line} style={{ ...smallCaps, fontSize: story ? "3.2cqw" : "2.6cqw", letterSpacing: "0.32em", transform: accentKind === "oval" ? "rotate(4deg)" : undefined }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}

        {accentKind === "arrow" ? <ArrowCircle color={ink} /> : null}
      </div>

      {story && linkSpace ? (
        <div
          data-export-ignore="true"
          style={{
            ...smallCaps,
            position: "absolute",
            left: "22%",
            right: "22%",
            bottom: "16cqw",
            padding: "2.6cqw 0 2.2cqw",
            border: `0.4cqw dashed ${ink}`,
            borderRadius: "3cqw",
            opacity: 0.5,
            textAlign: "center",
            fontSize: "3cqw",
            letterSpacing: "0.16em",
          }}
        >
          Link sticker
        </div>
      ) : null}

      <div style={{ position: "absolute", bottom: story ? "8cqw" : "6cqw", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Rule color={ink} width={12} />
      </div>
    </>
  )
}
