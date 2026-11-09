import { forwardRef, type CSSProperties } from "react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import { outfitNumberDot as numberDot, type SlidePiece } from "@/components/templates/outfit-slides"
import type { StoryBackground } from "@/lib/brands/story-kit"

/** Where the photo is centred in its frame, in percent: 50/50 is the middle. */
export type PhotoFocus = { x: number; y: number }

export const CENTRED: PhotoFocus = { x: 50, y: 50 }

type Props = {
  background: StoryBackground
  brandName: string
  /** Same-origin photo; null shows an empty frame to fill. */
  photoUrl: string | null
  focus: PhotoFocus
  /** e.g. OUTFIT CHECK. */
  heading: string
  /** The staff member, e.g. "Kim". Empty leaves the line off. */
  name: string
  /** Optional line under the name, e.g. "Wearing it to work". */
  line: string
  pieces: SlidePiece[]
  /** 9:16 for Stories, clear of Instagram's top bar and reply box; 4:5 for the feed. */
  story?: boolean
  className?: string
}

function Photo({ url, focus, background }: { url: string | null; focus: PhotoFocus; background: StoryBackground }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      crossOrigin="anonymous"
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focus.x}% ${focus.y}%` }}
    />
  ) : (
    <div
      data-export-ignore
      style={{ position: "absolute", inset: "5cqw", border: `0.4cqw dashed ${background.text_color}`, opacity: 0.35 }}
    />
  )
}

/** The pieces as a numbered list: small cutout, brand, then size and price in the accent. */
function PieceList({ pieces, background, style }: { pieces: SlidePiece[]; background: StoryBackground; style: CSSProperties }) {
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", ...style }}>
      {pieces.map((piece, index) => (
        <li
          key={piece.id}
          style={{
            borderTop: `0.25cqw solid ${background.text_color}`,
            paddingTop: "1.4cqw",
            display: "flex",
            gap: "2cqw",
            alignItems: "center",
          }}
        >
          <span aria-hidden style={{ ...numberDot(background), flexShrink: 0, width: "4cqw", height: "4cqw", fontSize: "2.3cqw" }}>
            {index + 1}
          </span>
          {piece.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={piece.imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "8cqw", height: "8cqw", objectFit: "contain", flexShrink: 0 }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <p style={{ ...caps, fontWeight: 600, fontSize: piece.brand.length > 14 ? "2.4cqw" : "2.9cqw", letterSpacing: "0.1em", lineHeight: 1.15, overflowWrap: "anywhere" }}>
              {piece.brand}
            </p>
            <p style={{ ...caps, fontSize: "2.3cqw", letterSpacing: "0.14em", marginTop: "0.6cqw", color: background.accent_color }}>
              {[piece.sizeLabel, piece.priceLabel].filter(Boolean).join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * A staff outfit check. Feed (4:5): the photo down the left, OUTFIT CHECK,
 * who's wearing it and the pieces on the right. Story (9:16): the photo on
 * top, the same words and pieces underneath.
 */
export const StaffOutfitSlide = forwardRef<HTMLDivElement, Props>(function StaffOutfitSlide(
  { background, brandName, photoUrl, focus, heading, name, line, pieces, story = false, className },
  ref
) {
  const title = { ...caps, fontWeight: 700, letterSpacing: "0.06em", lineHeight: 0.95 }
  const who = name.trim() ? (
    <p style={{ ...caps, fontSize: story ? "4.2cqw" : "3.4cqw", letterSpacing: "0.24em", color: background.accent_color, marginTop: "1.6cqw" }}>
      {name.trim()}
    </p>
  ) : null
  const note = line.trim() ? (
    <p style={{ margin: "1.2cqw 0 0", fontSize: story ? "3.4cqw" : "2.7cqw", lineHeight: 1.3, opacity: 0.85 }}>{line.trim()}</p>
  ) : null

  if (story) {
    return (
      <div ref={ref} className={className} style={frame(background, "9 / 16")}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "62%", overflow: "hidden" }}>
          <Photo url={photoUrl} focus={focus} background={background} />
        </div>
        <div style={{ position: "absolute", left: "6cqw", right: "6cqw", top: "calc(62% + 5cqw)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4cqw" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ ...title, fontSize: "9cqw" }}>{heading || "Outfit check"}</p>
            {who}
            {note}
          </div>
          <Wordmark brandName={brandName} accent={background.accent_color} size={3} />
        </div>
        <PieceList
          pieces={pieces}
          background={background}
          style={{ position: "absolute", left: "6cqw", right: "6cqw", bottom: "22cqw", gap: "1.6cqw" }}
        />
      </div>
    )
  }

  return (
    <div ref={ref} className={className} style={frame(background)}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "56%", overflow: "hidden" }}>
        <Photo url={photoUrl} focus={focus} background={background} />
      </div>
      <div style={{ position: "absolute", left: "60cqw", right: "4cqw", top: "5cqw" }}>
        <Wordmark brandName={brandName} accent={background.accent_color} size={2.6} />
        <p style={{ ...title, fontSize: "7.4cqw", marginTop: "6cqw" }}>{heading || "Outfit check"}</p>
        {who}
        {note}
      </div>
      <PieceList
        pieces={pieces}
        background={background}
        style={{ position: "absolute", left: "60cqw", right: "4cqw", bottom: "5cqw", gap: "1.6cqw" }}
      />
    </div>
  )
})
