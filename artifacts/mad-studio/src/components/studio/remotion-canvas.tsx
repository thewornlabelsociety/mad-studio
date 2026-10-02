"use client"

import { useMemo } from "react"
import { Player } from "@remotion/player"

import {
  StudioMediaComposition,
  type StudioMediaCompositionProps,
} from "@/components/studio/remotion/composition"
import { cn } from "@/lib/utils"

const PREVIEW_FPS = 30
const PREVIEW_DURATION_FRAMES = 300

export type RemotionCanvasProps = StudioMediaCompositionProps & {
  compositionWidth: number
  compositionHeight: number
  className?: string
}

export function RemotionCanvas({
  compositionWidth,
  compositionHeight,
  className,
  mediaUrl,
  mediaType,
  mediaFit,
  textOverlays,
  badge,
}: RemotionCanvasProps) {
  const inputPropsMemo = useMemo(
    () => ({
      mediaUrl,
      mediaType,
      mediaFit,
      textOverlays,
      badge,
    }),
    [mediaUrl, mediaType, mediaFit, textOverlays, badge]
  )

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
      <Player
        component={StudioMediaComposition}
        inputProps={inputPropsMemo}
        durationInFrames={PREVIEW_DURATION_FRAMES}
        fps={PREVIEW_FPS}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        loop
        autoPlay
        initiallyMuted
        clickToPlay={false}
        showVolumeControls={false}
      />
    </div>
  )
}
