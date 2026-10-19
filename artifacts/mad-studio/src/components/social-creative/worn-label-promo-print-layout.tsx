"use client"

import { forwardRef } from "react"

import {
  A4_PRINT_HEIGHT_PX,
  A4_PRINT_WIDTH_PX,
} from "@/lib/social-creative/promo-preview-channels"
import { tagColorSpec } from "@/lib/social-creative/worn-label-promo-theme"
import type { WornLabelCampaignConfig } from "@/types/social-creative"
import { cn } from "@/lib/utils"

type Props = {
  config: WornLabelCampaignConfig
  className?: string
}

const INK = "#0A0A0A"

/** In-store A4 weekly flyer — white only, bold black type + large tag dot */
export const WornLabelPromoPrintLayout = forwardRef<HTMLDivElement, Props>(
  function WornLabelPromoPrintLayout({ config, className }, ref) {
    const tag = tagColorSpec(config.colorName)
    const dotSize = 280

    return (
      <div
        ref={ref}
        data-promo-print="true"
        className={cn("relative flex flex-col bg-white", className)}
        style={{
          width: A4_PRINT_WIDTH_PX,
          height: A4_PRINT_HEIGHT_PX,
          color: INK,
          fontFamily: '"Space Mono", ui-monospace, monospace',
        }}
      >
        <main
          className="flex h-full flex-col items-center justify-between px-10 py-16"
          style={{ minHeight: A4_PRINT_HEIGHT_PX }}
        >
          <span
            className="shrink-0 rounded-full"
            style={{
              width: dotSize,
              height: dotSize,
              background: config.colorHex,
              boxShadow: tag.borderHighlight
                ? `0 0 0 6px ${INK}, 0 0 0 10px #ffffff`
                : `0 0 0 5px ${INK}`,
            }}
            aria-hidden
          />

          <p
            className="shrink-0 font-typewriter font-bold uppercase"
            style={{
              fontSize: 42,
              letterSpacing: "0.22em",
            }}
          >
            {config.colorName} tag
          </p>

          <p
            className="shrink-0 max-w-[92%] text-center font-black uppercase leading-[0.88]"
            style={{
              fontFamily: '"Bebas Neue", "Oswald", sans-serif',
              fontSize: 132,
              color: INK,
              letterSpacing: "0.02em",
            }}
          >
            {config.discountText}
          </p>

          <p
            className="shrink-0 border-[3px] border-black px-10 py-5 text-center font-typewriter font-bold uppercase"
            style={{
              color: INK,
              fontSize: 28,
              letterSpacing: "0.1em",
              maxWidth: "92%",
            }}
          >
            {config.dateLabel}
          </p>

          <p
            className="shrink-0 max-w-[680px] text-center font-bold uppercase leading-[1.08]"
            style={{
              fontFamily: '"Oswald", "Bebas Neue", sans-serif',
              fontSize: 46,
              color: INK,
              letterSpacing: "0.04em",
            }}
          >
            {config.headline}
          </p>
        </main>
      </div>
    )
  }
)
