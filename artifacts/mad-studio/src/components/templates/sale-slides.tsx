import { forwardRef, type CSSProperties } from "react"
import { ArrowRight } from "lucide-react"

import { KIT_DISPLAY_SCALE, kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"


/** Slide 1, type only: SALE RACK, the week it's for, and an optional line under it. */
export const SaleCoverSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    weekLabel: string
    /** Free text under the week, e.g. "Menswear edit" or "Surf vibes". */
    note?: string
    className?: string
  }
>(function SaleCoverSlide({ background, brandName, weekLabel, note = "", className }, ref) {
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", top: "6cqw", right: "6cqw" }}>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>
      <div style={{ position: "absolute", left: "6cqw", right: "6cqw", top: "50%", transform: "translateY(-50%)" }}>
        <p style={{ ...caps, fontSize: "5cqw", letterSpacing: "0.3em", color: background.accent_color }}>This week on the</p>
        <p style={{ ...caps, fontWeight: 700, fontSize: `calc(21cqw * ${KIT_DISPLAY_SCALE})`, letterSpacing: "0.04em", lineHeight: 0.92, marginTop: "1cqw" }}>
          Sale
          <br />
          Rack
        </p>
        <p style={{ ...caps, fontSize: "3.6cqw", letterSpacing: "0.22em", marginTop: "3cqw" }}>{weekLabel}</p>
        {note.trim() ? (
          <p
            style={{
              ...caps,
              fontWeight: 700,
              fontSize: "6.4cqw",
              letterSpacing: "0.12em",
              lineHeight: 1.1,
              marginTop: "5cqw",
              color: background.accent_color,
              overflowWrap: "break-word",
            }}
          >
            {note.trim()}
          </p>
        ) : null}
      </div>
      <p
        style={{
          ...caps,
          position: "absolute",
          right: "6cqw",
          bottom: "6cqw",
          display: "flex",
          alignItems: "center",
          gap: "1.6cqw",
          fontSize: "3.2cqw",
          letterSpacing: "0.26em",
          color: background.accent_color,
        }}
      >
        Swipe <ArrowRight style={{ width: "4cqw", height: "4cqw" }} aria-hidden />
      </p>
    </div>
  )
})
