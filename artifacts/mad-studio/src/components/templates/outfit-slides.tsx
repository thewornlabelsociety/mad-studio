import { forwardRef, type CSSProperties } from "react"
import { ArrowRight } from "lucide-react"

import { AdjustableLayer, type LayerAdjust } from "@/components/templates/adjustable-layer"
import type { StoryBackground } from "@/lib/brands/story-kit"
import type { GarmentSlot } from "@/lib/inventory/listing-garment"

const DISPLAY = "'Josefin Sans', 'Century Gothic', Futura, system-ui, sans-serif"

const caps: CSSProperties = { fontFamily: DISPLAY, textTransform: "uppercase", margin: 0 }

const frame = (background: StoryBackground): CSSProperties => ({
  position: "relative",
  aspectRatio: "4 / 5",
  width: "100%",
  overflow: "hidden",
  background: background.color,
  color: background.text_color,
  containerType: "inline-size",
})

/** Small numbered circle that ties a piece on the flatlay to its line in the list. */
const numberDot = (background: StoryBackground): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "4.6cqw",
  height: "4.6cqw",
  borderRadius: "50%",
  background: background.accent_color,
  color: background.color,
  fontFamily: DISPLAY,
  fontWeight: 700,
  fontSize: "2.6cqw",
  lineHeight: 1,
  paddingTop: "0.4cqw",
})

export type SlidePiece = {
  id: string
  slot: GarmentSlot
  imageUrl: string | null
  brand: string
  sizeLabel: string | null
  priceLabel: string | null
}

/** Where each kind of piece lies in the flatlay (percent of the flatlay area). */
const PLACEMENT: Record<GarmentSlot, { left: number; top: number; width: number; height: number; rotate: number; z: number }> = {
  outerwear: { left: 0, top: 2, width: 54, height: 56, rotate: -7, z: 1 },
  top: { left: 10, top: 0, width: 56, height: 52, rotate: -3, z: 2 },
  dress: { left: 12, top: 0, width: 62, height: 96, rotate: -2, z: 2 },
  bottom: { left: 34, top: 40, width: 52, height: 60, rotate: 4, z: 3 },
  shoes: { left: 0, top: 68, width: 40, height: 30, rotate: -10, z: 4 },
  accessory: { left: 66, top: 0, width: 34, height: 34, rotate: 8, z: 4 },
  other: { left: 62, top: 62, width: 36, height: 36, rotate: 6, z: 4 },
}

function Wordmark({ brandName, accent }: { brandName: string; accent: string }) {
  const words = brandName.trim().toUpperCase().split(/\s+/)
  const top = words.length > 1 ? words.slice(0, -1).join(" ") : words[0]
  const bottom = words.length > 1 ? words[words.length - 1] : ""
  return (
    <p style={{ ...caps, fontWeight: 600, fontSize: "3.4cqw", letterSpacing: "0.2em", lineHeight: 1.15, textAlign: "right" }}>
      {top}
      {bottom ? (
        <span style={{ display: "block", fontSize: "2.2cqw", letterSpacing: "0.5em", fontWeight: 400, color: accent }}>
          {bottom}
        </span>
      ) : null}
    </p>
  )
}

/** One day of the week: the outfit as a flatlay, its pieces listed down the side. */
export const OutfitSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    day: string
    vibe: string | null
    pieces: SlidePiece[]
    /** Hand placements by piece id; pieces without one sit in their automatic spot. */
    adjust?: Record<string, LayerAdjust>
    /** Given, pieces can be dragged, resized and tilted. */
    onAdjust?: (pieceId: string, next: LayerAdjust) => void
    selectedId?: string | null
    onSelect?: (pieceId: string | null) => void
    className?: string
  }
>(function OutfitSlide(
  { background, brandName, day, vibe, pieces, adjust, onAdjust, selectedId = null, onSelect, className },
  ref
) {
  const editable = Boolean(onAdjust)
  return (
    <div
      ref={ref}
      className={className}
      style={frame(background)}
      onPointerDown={editable ? () => onSelect?.(null) : undefined}
    >
      <div style={{ position: "absolute", inset: "6cqw 6cqw auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ ...caps, fontWeight: 700, fontSize: "9cqw", letterSpacing: "0.08em", lineHeight: 1 }}>{day}</p>
          {vibe ? (
            <p style={{ ...caps, fontSize: "3.4cqw", letterSpacing: "0.24em", color: background.accent_color, marginTop: "1.6cqw" }}>
              {vibe}
            </p>
          ) : null}
        </div>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>

      {/* Isolated so "send to back" stays above the slide colour. */}
      <div style={{ position: "absolute", left: "5cqw", top: "27%", width: "60%", bottom: "6cqw", isolation: "isolate" }}>
        {pieces.map((piece) => {
          const place = PLACEMENT[piece.slot]
          return piece.imageUrl ? (
            <AdjustableLayer
              key={piece.id}
              base={place}
              adjust={adjust?.[piece.id]}
              zIndex={place.z}
              editable={editable}
              selected={selectedId === piece.id}
              label={piece.brand}
              onSelect={() => onSelect?.(piece.id)}
              onChange={(next) => onAdjust?.(piece.id, next)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={piece.imageUrl}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  pointerEvents: "none",
                  filter: "drop-shadow(0 2cqw 2.4cqw rgba(0,0,0,0.3))",
                }}
              />
            </AdjustableLayer>
          ) : null
        })}

        {/* Numbers match the list; drawn above every piece so none is hidden,
            and follow each piece when it is moved or resized. */}
        {pieces.map((piece, index) => {
          if (!piece.imageUrl) return null
          const place = PLACEMENT[piece.slot]
          const moved = adjust?.[piece.id]
          const scale = moved?.scale ?? 1
          const cx = place.left + (moved?.dx ?? 0) + place.width / 2
          const cy = place.top + (moved?.dy ?? 0) + place.height / 2
          return (
            <span
              key={`n-${piece.id}`}
              aria-hidden
              style={{
                ...numberDot(background),
                position: "absolute",
                left: `${cx - (place.width * scale) * 0.36}%`,
                top: `${cy - (place.height * scale) * 0.4}%`,
                zIndex: 50,
                pointerEvents: "none",
              }}
            >
              {index + 1}
            </span>
          )
        })}
      </div>

      <ul
        style={{
          position: "absolute",
          right: "5cqw",
          width: "32%",
          top: "27%",
          bottom: "6cqw",
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "4cqw",
        }}
      >
        {pieces.map((piece, index) => (
          <li
            key={piece.id}
            style={{
              borderTop: `0.3cqw solid ${background.text_color}`,
              paddingTop: "1.8cqw",
              opacity: 0.95,
              display: "flex",
              gap: "1.8cqw",
              alignItems: "flex-start",
            }}
          >
            <span aria-hidden style={{ ...numberDot(background), flexShrink: 0 }}>
              {index + 1}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ ...caps, fontWeight: 600, fontSize: piece.brand.length > 14 ? "2.3cqw" : piece.brand.length > 9 ? "2.7cqw" : "3.2cqw", letterSpacing: "0.12em", lineHeight: 1.15, overflowWrap: "anywhere" }}>
                {piece.brand}
              </p>
              <p style={{ ...caps, fontSize: "2.5cqw", letterSpacing: "0.16em", marginTop: "1cqw", color: background.accent_color }}>
                {[piece.sizeLabel, piece.priceLabel].filter(Boolean).join(" · ")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
})

/** Slide 1, type only: A WEEK OF OUTFITS and the dates. */
export const OutfitCoverSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    dateRange: string
    className?: string
  }
>(function OutfitCoverSlide({ background, brandName, dateRange, className }, ref) {
  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", top: "6cqw", right: "6cqw" }}>
        <Wordmark brandName={brandName} accent={background.accent_color} />
      </div>
      <div style={{ position: "absolute", left: "6cqw", right: "6cqw", top: "50%", transform: "translateY(-50%)" }}>
        <p style={{ ...caps, fontSize: "5cqw", letterSpacing: "0.3em", color: background.accent_color }}>A week of</p>
        <p style={{ ...caps, fontWeight: 700, fontSize: "17cqw", letterSpacing: "0.04em", lineHeight: 0.95, marginTop: "1cqw" }}>
          Outfits
        </p>
        <p style={{ ...caps, fontSize: "3.6cqw", letterSpacing: "0.22em", marginTop: "3cqw" }}>{dateRange}</p>
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
