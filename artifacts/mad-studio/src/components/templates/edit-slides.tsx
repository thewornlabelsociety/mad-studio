import { forwardRef } from "react"

import { EDITORIAL_SERIF } from "@/components/templates/editorial-announcement"
import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

/**
 * One piece of a themed edit, 4:5, laid out like a magazine page: a ruled
 * header, the cutout centred, then the number, designer, a short rule and
 * one line of size, fabric and price, all on the centre line.
 */
export const EditItemSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** The edit's name, small top left, e.g. RACE DAY READY. */
    editLabel: string
    /** Place in the edit, shown as "No. 01". */
    index?: number
    /** The title page's style: editorial sets the designer in the tall serif. */
    editorial?: boolean
    imageUrl: string | null
    designer: string
    sizeLabel: string | null
    /** e.g. LINEN: a pill beside the size. */
    fabricLabel?: string | null
    priceLabel: string | null
    /** Marked down: the old price, struck through before the new one. */
    wasLabel?: string | null
    className?: string
  }
>(function EditItemSlide(
  { background, brandName, editLabel, index, editorial = false, imageUrl, designer, sizeLabel, fabricLabel = null, priceLabel, wasLabel = null, className },
  ref
) {
  const ink = background.text_color
  const accent = background.accent_color
  const pill = {
    ...caps,
    fontWeight: 600,
    fontSize: "2.6cqw",
    letterSpacing: "0.22em",
    padding: "1cqw 2.4cqw 0.7cqw",
    border: "0.3cqw solid currentColor",
    borderRadius: 999,
  }
  // The designer fits one line where it can, stepping down for long names.
  const designerSize = Math.min(editorial ? 9 : 7.4, 84 / Math.max(designer.length * (editorial ? 0.62 : 0.72), 1))
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", left: "7cqw", right: "7cqw", top: "6cqw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "4cqw" }}>
          <p style={{ ...caps, fontSize: "2.4cqw", letterSpacing: "0.34em", lineHeight: 1.4, color: accent }}>{editLabel}</p>
          <Wordmark brandName={brandName} accent={accent} size={2.6} />
        </div>
        <span style={{ display: "block", height: "0.25cqw", background: ink, opacity: 0.5, marginTop: "2.4cqw" }} />
      </div>

      <div style={{ position: "absolute", left: "12cqw", right: "12cqw", top: "17%", bottom: "35%" }}>
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
              filter: "drop-shadow(0 3cqw 3cqw rgba(0,0,0,0.28))",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: "7cqw",
          right: "7cqw",
          bottom: "7cqw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "2.4cqw",
        }}
      >
        {index != null && index > 0 ? (
          <p style={{ ...caps, fontSize: "2.4cqw", letterSpacing: "0.34em", color: accent }}>
            No. {String(index).padStart(2, "0")}
          </p>
        ) : null}
        <p
          style={
            editorial
              ? { margin: 0, fontFamily: EDITORIAL_SERIF, textTransform: "uppercase", fontWeight: 500, fontSize: `${designerSize}cqw`, letterSpacing: "0.02em", lineHeight: 1 }
              : { ...caps, fontWeight: 700, fontSize: `${designerSize}cqw`, letterSpacing: "0.1em", lineHeight: 1 }
          }
        >
          {designer}
        </p>
        <span style={{ display: "block", width: "12cqw", height: "0.25cqw", background: accent }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2.4cqw", flexWrap: "wrap" }}>
          {sizeLabel ? <p style={pill}>{sizeLabel}</p> : null}
          {fabricLabel ? <p style={pill}>{fabricLabel}</p> : null}
          {wasLabel ? (
            <p style={{ ...caps, fontSize: "3cqw", letterSpacing: "0.14em", textDecoration: "line-through", opacity: 0.6 }}>{wasLabel}</p>
          ) : null}
          {priceLabel ? (
            <p style={{ ...caps, fontWeight: 600, fontSize: "4.2cqw", letterSpacing: "0.12em", color: accent }}>{priceLabel}</p>
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
