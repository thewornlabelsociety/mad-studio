import { forwardRef } from "react"

import { EDITORIAL_SERIF } from "@/components/templates/editorial-announcement"
import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

export type CardAlign = "left" | "center" | "right"
/** The fabric pill's look: outlined, or filled in the accent, the text colour or cream. */
export type PillFill = "outline" | "accent" | "ink" | "cream"
export type PillShape = "round" | "soft" | "square"

/**
 * One piece of a themed edit, 4:5, laid out like a magazine page: a ruled
 * header, the cutout centred, then the eyebrow, the designer with its size
 * stacked under it, type and vibe, a short rule, and fabric and price, all
 * aligned left, centre or right. Any line given as null is left out.
 */
export const EditItemSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** The edit's name, small top left, e.g. RACE DAY READY. */
    editLabel: string
    /** Small line above the designer, e.g. NO. 01 or THE HAT. */
    eyebrow?: string | null
    /** The title page's style: editorial sets the designer in the tall serif. */
    editorial?: boolean
    /** Where the words sit under the piece. */
    align?: CardAlign
    imageUrl: string | null
    designer: string | null
    /** The kind of piece, e.g. FORMAL DRESS. */
    categoryLabel?: string | null
    vibeLabel?: string | null
    sizeLabel: string | null
    /** e.g. LINEN: a pill on its own row above the words. */
    fabricLabel?: string | null
    /** The pill lines up on its own, apart from the words. */
    pillAlign?: CardAlign
    pillFill?: PillFill
    pillShape?: PillShape
    priceLabel: string | null
    /** Marked down: the old price, struck through before the new one. */
    wasLabel?: string | null
    /** 9:16 for Stories; 4:5 for the feed. */
    story?: boolean
    className?: string
  }
>(function EditItemSlide(
  { background, brandName, editLabel, eyebrow = null, editorial = false, align = "center", imageUrl, designer, categoryLabel = null, vibeLabel = null, sizeLabel, fabricLabel = null, pillAlign = "right", pillFill = "outline", pillShape = "round", priceLabel, wasLabel = null, story = false, className },
  ref
) {
  const ink = background.text_color
  const accent = background.accent_color
  const pillColours: Record<PillFill, { background: string; color: string; borderColor: string }> = {
    outline: { background: "transparent", color: ink, borderColor: ink },
    accent: { background: accent, color: background.color, borderColor: accent },
    ink: { background: ink, color: background.color, borderColor: ink },
    cream: { background: "#F4F1EA", color: "#1A1A1A", borderColor: "#F4F1EA" },
  }
  const pill = {
    ...caps,
    ...pillColours[pillFill],
    fontWeight: 600,
    fontSize: "2.6cqw",
    letterSpacing: "0.22em",
    padding: "1cqw 2.4cqw 0.7cqw",
    borderWidth: "0.3cqw",
    borderStyle: "solid",
    borderRadius: pillShape === "round" ? 999 : pillShape === "soft" ? "1.2cqw" : 0,
  }
  // The designer fits one line where it can, stepping down for long names.
  const name = designer?.trim() ?? ""
  const designerSize = Math.min(editorial ? 6 : 4.8, 84 / Math.max(name.length * (editorial ? 0.62 : 0.72), 1))
  const meta = [categoryLabel, vibeLabel].map((part) => part?.trim()).filter(Boolean).join(" · ")
  const hasLine = Boolean(priceLabel)
  const toFlex = (side: CardAlign) => (side === "left" ? "flex-start" : side === "right" ? "flex-end" : "center")
  const flexAlign = toFlex(align)
  // Stories keep clear of Instagram's top bar and the reply box at the bottom.
  const top = story ? 13 : 6
  return (
    <div ref={ref} className={className} style={frame(background, story ? "9 / 16" : "4 / 5")}>
      <div style={{ position: "absolute", left: "7cqw", right: "7cqw", top: `${top}cqw` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "4cqw" }}>
          <p style={{ ...caps, fontSize: "2.4cqw", letterSpacing: "0.34em", lineHeight: 1.4, color: accent }}>{editLabel}</p>
          <Wordmark brandName={brandName} accent={accent} size={2.6} />
        </div>
        <span style={{ display: "block", height: "0.25cqw", background: ink, opacity: 0.5, marginTop: "2.4cqw" }} />
        {/* The fabric pill sits under the header, top right unless moved. */}
        {fabricLabel ? (
          <div style={{ display: "flex", justifyContent: toFlex(pillAlign), marginTop: "3cqw" }}>
            <p style={pill}>{fabricLabel}</p>
          </div>
        ) : null}
      </div>

      <div style={{ position: "absolute", left: "12cqw", right: "12cqw", top: story ? "22%" : "21%", bottom: story ? "30%" : "35%" }}>
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
          bottom: story ? "22cqw" : "7cqw",
          display: "flex",
          flexDirection: "column",
          alignItems: flexAlign,
          textAlign: align,
          gap: "2.4cqw",
        }}
      >
        {eyebrow?.trim() ? (
          <p style={{ ...caps, fontSize: "2.2cqw", letterSpacing: "0.34em", color: accent }}>{eyebrow.trim()}</p>
        ) : null}
        {/* Brand with its size stacked under it, no pill. */}
        {name || sizeLabel ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: flexAlign, gap: "1.2cqw" }}>
            {name ? (
              <p
                style={
                  editorial
                    ? { margin: 0, fontFamily: EDITORIAL_SERIF, textTransform: "uppercase", fontWeight: 500, fontSize: `${designerSize}cqw`, letterSpacing: "0.04em", lineHeight: 1.05 }
                    : { ...caps, fontWeight: 600, fontSize: `${designerSize}cqw`, letterSpacing: "0.16em", lineHeight: 1.1 }
                }
              >
                {name}
              </p>
            ) : null}
            {sizeLabel ? (
              <p style={{ ...caps, fontSize: "2.5cqw", letterSpacing: "0.3em" }}>{sizeLabel}</p>
            ) : null}
          </div>
        ) : null}
        {meta ? (
          <p style={{ ...caps, fontSize: "2.3cqw", letterSpacing: "0.26em", opacity: 0.85 }}>{meta}</p>
        ) : null}
        {hasLine ? <span style={{ display: "block", width: "10cqw", height: "0.25cqw", background: accent }} /> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: flexAlign, gap: "2.4cqw", flexWrap: "wrap" }}>
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
