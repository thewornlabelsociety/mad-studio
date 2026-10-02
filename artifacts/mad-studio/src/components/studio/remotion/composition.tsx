import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { Video } from "@remotion/media"

import type {
  RemotionBadgeOverlay,
  RemotionTextOverlay,
} from "@/lib/studio/remotion-overlays"
import {
  REMOTION_SAFE_BOTTOM_PX,
  REMOTION_SAFE_TOP_PX,
} from "@/lib/studio/remotion-overlays"

export type StudioMediaCompositionProps = {
  mediaUrl: string
  mediaType: "video" | "image"
  mediaFit: "cover" | "contain"
  textOverlays: RemotionTextOverlay[]
  badge: RemotionBadgeOverlay | null
}

function BackgroundMedia({
  mediaUrl,
  mediaType,
  mediaFit,
}: Pick<StudioMediaCompositionProps, "mediaUrl" | "mediaType" | "mediaFit">) {
  if (mediaType === "video") {
    return (
      <Video
        src={mediaUrl}
        style={{
          width: "100%",
          height: "100%",
          objectFit: mediaFit,
        }}
        muted
        loop
      />
    )
  }

  if (mediaFit === "contain") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(24px)",
            opacity: 0.35,
            transform: "scale(1.1)",
          }}
        />
        <AbsoluteFill className="flex items-center justify-center p-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
            }}
          />
        </AbsoluteFill>
      </>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  )
}

function clampYPercent(y: number, height: number): number {
  const minPx = REMOTION_SAFE_TOP_PX
  const maxPx = height - REMOTION_SAFE_BOTTOM_PX
  const px = (y / 100) * height
  const clamped = Math.min(maxPx, Math.max(minPx, px))
  return (clamped / height) * 100
}

function KineticHookBlock({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return null

  const hookFrames = Math.round(3 * fps)
  const progress = interpolate(frame, [0, hookFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  const visible = Math.max(1, Math.ceil(progress * words.length))

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 12,
        maxWidth: "88%",
        textAlign: "center",
        fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
        fontSize: 72,
        fontWeight: 900,
        lineHeight: 1.05,
        color: "#FFFFFF",
        textTransform: "uppercase",
        textShadow: "3px 3px 0 #000, -1px -1px 0 #000",
      }}
    >
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{
            opacity: index < visible ? 1 : 0.12,
            transform: index < visible ? "scale(1)" : "scale(0.92)",
          }}
        >
          {word}
        </span>
      ))}
    </div>
  )
}

function AcidLimePill({ text, fontScale = 1 }: { text: string; fontScale?: number }) {
  const size = 56 * fontScale
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: "#CCFF00",
        color: "#000000",
        fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.05,
        padding: `${size * 0.12}px ${size * 0.28}px`,
        borderRadius: 4,
        textTransform: "uppercase",
        boxShadow: "2px 2px 0 rgba(0,0,0,0.85)",
      }}
    >
      {text}
    </span>
  )
}

function PlainTextBlock({
  text,
  fontScale = 1,
}: {
  text: string
  fontScale?: number
}) {
  const size = 48 * fontScale
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: "92%",
        fontFamily: "Impact, Haettenschweiler, Arial Narrow Bold, sans-serif",
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.05,
        color: "#FFFFFF",
        textTransform: "uppercase",
        textShadow: "2px 2px 0 rgba(0,0,0,0.9)",
      }}
    >
      {text}
    </span>
  )
}

function TextOverlayLayer({ block }: { block: RemotionTextOverlay }) {
  const { height } = useVideoConfig()
  const y = clampYPercent(block.y, height)
  const preset = block.preset

  return (
    <div
      style={{
        position: "absolute",
        left: `${block.x}%`,
        top: `${y}%`,
        transform: `translate(-50%, -50%) rotate(${block.rotationDeg ?? 0}deg)`,
        transformOrigin: "center center",
        maxWidth: "92%",
        textAlign: "center",
      }}
    >
      {preset === "kinetic_hook" ? (
        <KineticHookBlock text={block.text} />
      ) : preset === "acid_lime_pill" ? (
        <AcidLimePill text={block.text} fontScale={block.fontScale} />
      ) : (
        <PlainTextBlock text={block.text} fontScale={block.fontScale} />
      )}
    </div>
  )
}

function BadgeLayer({ badge }: { badge: RemotionBadgeOverlay }) {
  const { height } = useVideoConfig()
  const y = clampYPercent(badge.y, height)

  return (
    <div
      style={{
        position: "absolute",
        left: `${badge.x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.35)",
          backgroundColor: "rgba(24,24,22,0.9)",
          color: "#EDECE8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 28,
          letterSpacing: "0.16em",
          padding: "14px 28px",
          textTransform: "uppercase",
        }}
      >
        {badge.label}
      </span>
    </div>
  )
}

export function StudioMediaComposition({
  mediaUrl,
  mediaType,
  mediaFit,
  textOverlays,
  badge,
}: StudioMediaCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <BackgroundMedia
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        mediaFit={mediaFit}
      />
      {textOverlays.map((block) => (
        <TextOverlayLayer key={block.id} block={block} />
      ))}
      {badge ? <BadgeLayer badge={badge} /> : null}
    </AbsoluteFill>
  )
}
