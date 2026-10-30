import { forwardRef } from "react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

/** One piece of a themed edit, 4:5: the edit's name, the cutout, then designer, size and price. */
export const EditItemSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** The edit's name, small top left, e.g. RACE DAY READY. */
    editLabel: string
    imageUrl: string | null
    designer: string
    sizeLabel: string | null
    priceLabel: string | null
    /** Marked down: the old price, struck through before the new one. */
    wasLabel?: string | null
    className?: string
  }
>(function EditItemSlide(
  { background, brandName, editLabel, imageUrl, designer, sizeLabel, priceLabel, wasLabel = null, className },
  ref
) {
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", inset: "6cqw 6cqw auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4cqw" }}>
        <p style={{ ...caps, fontSize: "3.6cqw", letterSpacing: "0.3em", lineHeight: 1.3, color: background.accent_color }}>{editLabel}</p>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>

      <div style={{ position: "absolute", left: "8cqw", right: "8cqw", top: "16%", bottom: "30%" }}>
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
          {wasLabel ? (
            <p style={{ ...caps, fontSize: "4.4cqw", letterSpacing: "0.12em", textDecoration: "line-through", opacity: 0.6 }}>
              {wasLabel}
            </p>
          ) : null}
          {priceLabel ? (
            <p style={{ ...caps, fontWeight: 700, fontSize: "7cqw", letterSpacing: "0.06em", color: background.accent_color }}>
              {priceLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
})

/** A full-bleed photo between the pieces: a styled look or mood shot, the wordmark in the corner. */
export const EditPhotoSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** Same-origin photo. */
    photoUrl: string
    /** 9:16 for Stories; 4:5 for the feed. */
    story?: boolean
    className?: string
  }
>(function EditPhotoSlide({ background, brandName, photoUrl, story = false, className }, ref) {
  return (
    <div ref={ref} className={className} style={{ ...frame(background, story ? "9 / 16" : "4 / 5"), isolation: "isolate" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoUrl}
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: -1 }}
      />
      {/* A soft shade behind the wordmark so it reads on any photo. */}
      <div style={{ position: "absolute", inset: "0 0 auto", height: "26%", background: "linear-gradient(rgba(0,0,0,0.38), rgba(0,0,0,0))" }} />
      <div style={{ position: "absolute", top: "6cqw", right: "6cqw", color: "#FFFFFF" }}>
        <Wordmark brandName={brandName} accent="#F1EADB" size={story ? 5 : 3.4} />
      </div>
    </div>
  )
})
