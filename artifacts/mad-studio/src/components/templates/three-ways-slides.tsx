import { forwardRef } from "react"
import { ArrowRight } from "lucide-react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

/** Slide 1: the one piece, big, under ONE PIECE / THREE WAYS, with its brand, size and price. */
export const ThreeWaysCoverSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** Small line above the title, e.g. ONE PIECE. */
    kicker: string
    /** The big words, e.g. THREE WAYS. */
    title: string
    imageUrl: string | null
    designer: string
    /** e.g. SIZE 10 · $45. */
    detail: string | null
    className?: string
  }
>(function ThreeWaysCoverSlide({ background, brandName, kicker, title, imageUrl, designer, detail, className }, ref) {
  const longest = Math.max(...title.split(/\s+/).map((word) => word.length), 1)
  const titleSize = Math.min(13, 88 / (longest * 0.72))
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", inset: "6cqw 6cqw auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          {kicker.trim() ? (
            <p style={{ ...caps, fontSize: "4cqw", letterSpacing: "0.3em", color: background.accent_color }}>{kicker}</p>
          ) : null}
          <p style={{ ...caps, fontWeight: 700, fontSize: `${titleSize}cqw`, letterSpacing: "0.04em", lineHeight: 0.95, marginTop: "1cqw" }}>
            {title || "Three ways"}
          </p>
        </div>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>

      <div style={{ position: "absolute", left: "12cqw", right: "12cqw", top: "30%", bottom: "20%" }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 3cqw 3cqw rgba(0,0,0,0.3))",
            }}
          />
        ) : null}
      </div>

      <div style={{ position: "absolute", left: "6cqw", right: "6cqw", bottom: "6cqw", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "4cqw" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...caps, fontWeight: 700, fontSize: designer.length > 16 ? "5cqw" : "6.4cqw", letterSpacing: "0.06em", lineHeight: 1 }}>
            {designer}
          </p>
          {detail ? (
            <p style={{ ...caps, fontSize: "3.2cqw", letterSpacing: "0.2em", marginTop: "1.6cqw", color: background.accent_color }}>
              {detail}
            </p>
          ) : null}
        </div>
        <p
          style={{
            ...caps,
            display: "flex",
            alignItems: "center",
            gap: "1.6cqw",
            flexShrink: 0,
            fontSize: "3.2cqw",
            letterSpacing: "0.26em",
            color: background.accent_color,
          }}
        >
          Swipe <ArrowRight style={{ width: "4cqw", height: "4cqw" }} aria-hidden />
        </p>
      </div>
    </div>
  )
})
