"use client"

import { forwardRef } from "react"

import { DateBadge } from "@/components/social-creative/date-styles"
import {
  PROMO_EXPORT_WIDTH,
  promoExportHeight,
} from "@/lib/social-creative/export-promo-png"
import {
  tagColorSpec,
  WLS_PROMO_THEME,
} from "@/lib/social-creative/worn-label-promo-theme"
import type { WornLabelCampaignConfig } from "@/types/social-creative"
import { cn } from "@/lib/utils"

type Props = {
  config: WornLabelCampaignConfig
  className?: string
}

function motionClass(motion: WornLabelCampaignConfig["motionStyle"]): string {
  switch (motion) {
    case "sheen":
      return "promo-motion-sheen"
    case "pop":
      return "promo-motion-pop"
    case "subtle":
      return "promo-motion-subtle"
    case "pulse":
    default:
      return "promo-motion-pulse"
  }
}

export const WornLabelPromoLayout = forwardRef<HTMLDivElement, Props>(
  function WornLabelPromoLayout({ config, className }, ref) {
    const width = PROMO_EXPORT_WIDTH
    const height = promoExportHeight(config.aspectRatio)
    const isStory = config.aspectRatio === "9:16"
    const tag = tagColorSpec(config.colorName)
    const glow = config.colorHex

    return (
      <div
        ref={ref}
        data-promo-export="true"
        data-aspect={config.aspectRatio}
        className={cn("relative overflow-hidden select-none", className)}
        style={{
          width,
          height,
          background: WLS_PROMO_THEME.bg,
          fontFamily: '"Space Mono", ui-monospace, monospace',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 85% 55% at 50% 38%, ${glow}55 0%, transparent 62%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(circle at 20% 80%, ${WLS_PROMO_THEME.champagneGoldMuted} 0%, transparent 45%)`,
          }}
        />

        <div
          className={cn(
            "relative z-10 flex h-full flex-col px-5",
            isStory ? "py-7" : "py-5"
          )}
        >
          <p
            className="text-center font-typewriter font-bold uppercase"
            style={{
              color: WLS_PROMO_THEME.champagneGold,
              fontSize: isStory ? 7 : 6,
              letterSpacing: "0.28em",
              lineHeight: 1.3,
            }}
          >
            {config.eyebrow}
          </p>

          <div
            className={cn(
              "mt-3 flex flex-col items-center leading-none",
              isStory ? "mt-4" : "mt-2"
            )}
          >
            <span
              className="font-bold tracking-[0.35em] uppercase"
              style={{
                color: WLS_PROMO_THEME.champagneGold,
                fontSize: isStory ? 11 : 9,
              }}
            >
              WORN LABEL
            </span>
            <span
              className="mt-0.5 font-bold tracking-[0.42em] uppercase opacity-90"
              style={{
                color: "#F5F0E8",
                fontSize: isStory ? 8 : 7,
              }}
            >
              SOCIETY
            </span>
          </div>

          <div className={cn("flex flex-1 flex-col items-center justify-center", isStory ? "gap-4" : "gap-3")}>
            <div
              className={cn(
                "relative w-[88%] max-w-[320px] rounded-2xl px-4 py-4 text-center",
                motionClass(config.motionStyle)
              )}
              style={{
                background: `linear-gradient(145deg, ${WLS_PROMO_THEME.surface} 0%, #0c0c0e 100%)`,
                border: `1px solid ${WLS_PROMO_THEME.border}`,
                boxShadow: `0 18px 40px rgba(0,0,0,0.55), 0 0 48px ${glow}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-3 rounded-xl opacity-60"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${glow}44 0%, transparent 70%)`,
                }}
              />
              <div className="relative flex flex-col items-center gap-2">
                <div
                  className="flex items-center gap-2 rounded-full px-2 py-1"
                  style={{ background: "rgba(0,0,0,0.35)" }}
                >
                  <span
                    className="size-3.5 shrink-0 rounded-full"
                    style={{
                      background: config.colorHex,
                      boxShadow: tag.borderHighlight
                        ? "0 0 0 2px rgba(255,255,255,0.35)"
                        : `0 0 12px ${config.colorHex}aa`,
                    }}
                  />
                  <span
                    className="font-typewriter text-[0.5rem] font-bold tracking-[0.2em] uppercase"
                    style={{ color: WLS_PROMO_THEME.champagneGold }}
                  >
                    {config.colorName} TAG
                  </span>
                </div>
                <p
                  className="font-bold uppercase leading-none"
                  style={{
                    fontFamily: '"Bebas Neue", "Oswald", sans-serif',
                    fontSize: isStory ? 42 : 36,
                    color: tag.contrastText === "#111111" ? "#FFFFFF" : "#FFFFFF",
                    textShadow: `0 2px 24px ${glow}88`,
                    letterSpacing: "0.02em",
                  }}
                >
                  {config.discountText}
                </p>
              </div>
            </div>

            <DateBadge
              label={config.dateLabel}
              style={config.dateStyle}
              compact={!isStory}
            />

            <h2
              className="max-w-[92%] text-center font-bold uppercase leading-tight"
              style={{
                fontFamily: '"Oswald", "Bebas Neue", sans-serif',
                fontSize: isStory ? 16 : 13,
                color: "#F8F6F2",
                letterSpacing: "0.04em",
              }}
            >
              {config.headline}
            </h2>
          </div>

          <footer className="mt-auto shrink-0 pt-3">
            <div
              className="mb-2 h-px w-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${WLS_PROMO_THEME.champagneGold}, transparent)`,
              }}
            />
            <p
              className="text-center font-typewriter font-bold uppercase"
              style={{
                color: WLS_PROMO_THEME.champagneGold,
                fontSize: isStory ? 6.5 : 6,
                letterSpacing: "0.14em",
                lineHeight: 1.4,
              }}
            >
              {config.storeNotice}
            </p>
          </footer>
        </div>

        <style>{`
          @keyframes promo-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.02); }
          }
          @keyframes promo-pop {
            0%, 100% { transform: scale(1); }
            40% { transform: scale(1.04); }
          }
          @keyframes promo-subtle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.92; }
          }
          @keyframes promo-sheen {
            0% { background-position: -120% 0; }
            100% { background-position: 220% 0; }
          }
          .promo-motion-pulse { animation: promo-pulse 2.4s ease-in-out infinite; }
          .promo-motion-pop { animation: promo-pop 1.8s ease-in-out infinite; }
          .promo-motion-subtle { animation: promo-subtle 3s ease-in-out infinite; }
          .promo-motion-sheen {
            position: relative;
            overflow: hidden;
          }
          .promo-motion-sheen::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              105deg,
              transparent 35%,
              rgba(255,255,255,0.12) 50%,
              transparent 65%
            );
            background-size: 200% 100%;
            animation: promo-sheen 2.8s ease-in-out infinite;
            pointer-events: none;
            border-radius: inherit;
          }
        `}</style>
      </div>
    )
  }
)
