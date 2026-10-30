import { forwardRef } from "react"

import { AdjustableLayer, type LayerAdjust } from "@/components/templates/adjustable-layer"
import { KIT_DISPLAY as DISPLAY, kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import { OUTFIT_PLACEMENT as PLACEMENT, outfitNumberDot as numberDot, type SlidePiece } from "@/components/templates/outfit-slides"
import type { StoryBackground } from "@/lib/brands/story-kit"

/** Layer id for the inspo cutout in the placements map. */
export const INSPO_LAYER_ID = "inspo"

/** Where the inspo cutout sits in the left half (percent of that half). */
const INSPO_CUTOUT_BASE = { left: 4, top: 14, width: 92, height: 80, rotate: 0 }

/**
 * One feed slide, 4:5: the inspo look on the left, the same look from the
 * racks as a flatlay on the right, its pieces listed underneath.
 */
export const InspoVsWlsSlide = forwardRef<
  HTMLDivElement,
  {
    background: StoryBackground
    brandName: string
    /** Same-origin photo; null shows an empty frame to fill. */
    inspoUrl: string | null
    /** The photo is a cutout: it sits on the slide colour and can be moved. */
    inspoCutout: boolean
    /** e.g. "Inspo: @handle". Empty hides it. */
    credit: string
    pieces: SlidePiece[]
    /** Hand placements by piece id (and INSPO_LAYER_ID for the cutout). */
    adjust?: Record<string, LayerAdjust>
    /** Given, the cutout and pieces can be dragged, resized and tilted. */
    onAdjust?: (layerId: string, next: LayerAdjust) => void
    selectedId?: string | null
    onSelect?: (layerId: string | null) => void
    className?: string
  }
>(function InspoVsWlsSlide(
  { background, brandName, inspoUrl, inspoCutout, credit, pieces, adjust, onAdjust, selectedId = null, onSelect, className },
  ref
) {
  const editable = Boolean(onAdjust)
  const label = { ...caps, fontWeight: 700, fontSize: "6.4cqw", letterSpacing: "0.14em", lineHeight: 1 }
  const chip = {
    ...caps,
    display: "inline-block",
    background: background.color,
    color: background.text_color,
    padding: "1.4cqw 2.2cqw 1cqw",
  }

  return (
    <div
      ref={ref}
      className={className}
      style={frame(background)}
      onPointerDown={editable ? () => onSelect?.(null) : undefined}
    >
      {/* Left: the inspo look. */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", overflow: "hidden", isolation: "isolate" }}>
        {inspoUrl && !inspoCutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inspoUrl}
            alt=""
            crossOrigin="anonymous"
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        {inspoUrl && inspoCutout ? (
          <AdjustableLayer
            base={INSPO_CUTOUT_BASE}
            adjust={adjust?.[INSPO_LAYER_ID]}
            zIndex={1}
            editable={editable}
            selected={selectedId === INSPO_LAYER_ID}
            label="Inspo"
            onSelect={() => onSelect?.(INSPO_LAYER_ID)}
            onChange={(next) => onAdjust?.(INSPO_LAYER_ID, next)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={inspoUrl}
              alt=""
              crossOrigin="anonymous"
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                pointerEvents: "none",
                filter: "drop-shadow(0 2cqw 2.4cqw rgba(0,0,0,0.25))",
              }}
            />
          </AdjustableLayer>
        ) : null}
        {!inspoUrl ? (
          <div
            data-export-ignore
            style={{
              position: "absolute",
              inset: "16cqw 5cqw 10cqw",
              border: `0.4cqw dashed ${background.text_color}`,
              opacity: 0.35,
            }}
          />
        ) : null}
        <p style={{ position: "absolute", left: "4cqw", top: "5cqw", zIndex: 5, margin: 0 }}>
          <span style={{ ...chip, ...label }}>Inspo</span>
        </p>
        {credit.trim() ? (
          <p style={{ position: "absolute", left: "4cqw", bottom: "4cqw", zIndex: 5, margin: 0, maxWidth: "42cqw" }}>
            <span style={{ ...chip, fontSize: "2.4cqw", letterSpacing: "0.14em", overflowWrap: "anywhere" }}>
              {credit.trim()}
            </span>
          </p>
        ) : null}
      </div>

      {/* The line between the two looks, with VS on it. */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: "0.3cqw", marginLeft: "-0.15cqw", background: background.text_color, opacity: 0.25 }} />
      <span
        style={{
          ...caps,
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "11cqw",
          height: "11cqw",
          borderRadius: "50%",
          background: background.accent_color,
          color: background.color,
          fontFamily: DISPLAY,
          fontWeight: 700,
          fontSize: "4cqw",
          letterSpacing: "0.06em",
          paddingTop: "0.6cqw",
        }}
      >
        vs
      </span>

      {/* Right: the look from the racks. */}
      <div style={{ position: "absolute", left: "54cqw", right: "4cqw", top: "5cqw", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ ...label, paddingTop: "1.4cqw" }}>WLS</p>
        <Wordmark brandName={brandName} accent={background.accent_color} size={2.6} />
      </div>

      {/* Isolated so "send to back" stays above the slide colour. */}
      <div style={{ position: "absolute", left: "53cqw", width: "44cqw", top: "17cqw", height: "68cqw", isolation: "isolate" }}>
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

        {/* Numbers match the list and follow each piece when it moves. */}
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
                left: `${cx - place.width * scale * 0.36}%`,
                top: `${cy - place.height * scale * 0.4}%`,
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
          left: "54cqw",
          right: "4cqw",
          bottom: "4cqw",
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "1.4cqw",
        }}
      >
        {pieces.map((piece, index) => (
          <li
            key={piece.id}
            style={{
              borderTop: `0.25cqw solid ${background.text_color}`,
              paddingTop: "1.2cqw",
              display: "flex",
              gap: "1.6cqw",
              alignItems: "center",
            }}
          >
            <span aria-hidden style={{ ...numberDot(background), flexShrink: 0, width: "3.6cqw", height: "3.6cqw", fontSize: "2.1cqw" }}>
              {index + 1}
            </span>
            <p style={{ ...caps, minWidth: 0, fontWeight: 600, fontSize: "2.2cqw", letterSpacing: "0.1em", lineHeight: 1.2, overflowWrap: "anywhere" }}>
              {piece.brand}
              <span style={{ fontWeight: 400, color: background.accent_color }}>
                {[piece.sizeLabel, piece.priceLabel].filter(Boolean).map((part) => ` · ${part}`).join("")}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
})
