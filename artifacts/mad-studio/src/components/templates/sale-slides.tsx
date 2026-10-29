import { forwardRef, type CSSProperties } from "react"
import { ArrowRight } from "lucide-react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"


/** Slide 1, type only: SALE RACK and the week it's for. */
export const SaleCoverSlide = forwardRef<
  HTMLDivElement,
  { background: StoryBackground; brandName: string; weekLabel: string; className?: string }
>(function SaleCoverSlide({ background, brandName, weekLabel, className }, ref) {
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", top: "6cqw", right: "6cqw" }}>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>
      <div style={{ position: "absolute", left: "6cqw", right: "6cqw", top: "50%", transform: "translateY(-50%)" }}>
        <p style={{ ...caps, fontSize: "5cqw", letterSpacing: "0.3em", color: background.accent_color }}>This week on the</p>
        <p style={{ ...caps, fontWeight: 700, fontSize: "21cqw", letterSpacing: "0.04em", lineHeight: 0.92, marginTop: "1cqw" }}>
          Sale
          <br />
          Rack
        </p>
        <p style={{ ...caps, fontSize: "3.6cqw", letterSpacing: "0.22em", marginTop: "3cqw" }}>{weekLabel}</p>
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

/** One marked-down piece: the cutout, brand and size, the old price struck through. */
export const SaleItemSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    imageUrl: string | null
    designer: string
    sizeLabel: string | null
    wasLabel: string
    nowLabel: string
    percentOff: number
    className?: string
  }
>(function SaleItemSlide(
  { background, brandName, imageUrl, designer, sizeLabel, wasLabel, nowLabel, percentOff, className },
  ref
) {
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", inset: "6cqw 6cqw auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ ...caps, fontSize: "3.6cqw", letterSpacing: "0.3em", color: background.accent_color }}>Sale rack</p>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>

      <div style={{ position: "absolute", left: "8cqw", right: "8cqw", top: "16%", bottom: "34%" }}>
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

      {percentOff > 0 ? (
        <div
          style={{
            ...caps,
            position: "absolute",
            right: "7cqw",
            top: "16%",
            width: "19cqw",
            height: "19cqw",
            borderRadius: "50%",
            background: background.accent_color,
            color: background.color,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "5cqw",
            lineHeight: 0.95,
            transform: "rotate(-10deg)",
          }}
        >
          <span>
            {percentOff}%
            <span style={{ display: "block", fontSize: "3cqw", letterSpacing: "0.16em" }}>off</span>
          </span>
        </div>
      ) : null}

      <div style={{ position: "absolute", left: "6cqw", right: "6cqw", bottom: "6cqw", display: "grid", gap: "2cqw" }}>
        <p style={{ ...caps, fontWeight: 700, fontSize: designer.length > 16 ? "6.6cqw" : "8.4cqw", letterSpacing: "0.06em", lineHeight: 1 }}>
          {designer}
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4cqw", flexWrap: "wrap" }}>
          {sizeLabel ? (
            <p style={{ ...caps, fontWeight: 600, fontSize: "3.6cqw", letterSpacing: "0.2em", padding: "1.2cqw 2.8cqw 0.8cqw", border: "0.4cqw solid currentColor", borderRadius: 999 }}>
              {sizeLabel}
            </p>
          ) : null}
          <p style={{ ...caps, fontSize: "4.4cqw", letterSpacing: "0.12em", textDecoration: "line-through", opacity: 0.6 }}>
            {wasLabel}
          </p>
          <p style={{ ...caps, fontWeight: 700, fontSize: "7cqw", letterSpacing: "0.06em", color: background.accent_color }}>
            {nowLabel}
          </p>
        </div>
      </div>
    </div>
  )
})
