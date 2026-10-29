import type { CSSProperties } from "react"

import type { StoryBackground } from "@/lib/brands/story-kit"

/** The kit's one typeface: letter-spaced capitals, as on the website. */
export const KIT_DISPLAY = "'Josefin Sans', 'Century Gothic', Futura, system-ui, sans-serif"

export const kitCaps: CSSProperties = { fontFamily: KIT_DISPLAY, textTransform: "uppercase", margin: 0 }

/** A slide or Story frame on one kit background; sizes inside use cqw. */
export function kitFrame(background: StoryBackground, aspect = "4 / 5"): CSSProperties {
  return {
    position: "relative",
    aspectRatio: aspect,
    width: "100%",
    overflow: "hidden",
    background: background.color,
    color: background.text_color,
    containerType: "inline-size",
  }
}

/** Brand name as a wordmark; the last word sits below, widely spaced, in the accent. */
export function KitWordmark({
  brandName,
  accent,
  size = 3.4,
  align = "right",
}: {
  brandName: string
  accent: string
  /** Top line size in cqw. */
  size?: number
  align?: "left" | "right"
}) {
  const words = brandName.trim().toUpperCase().split(/\s+/)
  const top = words.length > 1 ? words.slice(0, -1).join(" ") : words[0]
  const bottom = words.length > 1 ? words[words.length - 1] : ""
  return (
    <p style={{ ...kitCaps, fontWeight: 600, fontSize: `${size}cqw`, letterSpacing: "0.2em", lineHeight: 1.15, textAlign: align }}>
      {top}
      {bottom ? (
        <span style={{ display: "block", fontSize: `${size * 0.64}cqw`, letterSpacing: "0.5em", fontWeight: 400, color: accent }}>
          {bottom}
        </span>
      ) : null}
    </p>
  )
}
