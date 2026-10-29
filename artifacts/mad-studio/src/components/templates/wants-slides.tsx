import { forwardRef, type CSSProperties } from "react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"
import type { WantsItem } from "@/lib/entities/dna-schema"


type Props = {
  background: StoryBackground
  brandName: string
  items: WantsItem[]
  note: string
  className?: string
}

/**
 * "We're searching for": type only, in the kit. The Story leaves room at the
 * bottom for a link sticker; the feed card is 4:5.
 */
function WantsLayout({ background, brandName, items, note, story }: Props & { story: boolean }) {
  const rows = items.filter((item) => item.label.trim())
  const unit = story ? 1 : 0.92
  const fit = rows.length > 6 ? 0.82 : 1
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: story ? "5.5cqw 6cqw auto" : "6cqw 6cqw auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Wordmark brandName={brandName} accent={background.accent_color} size={story ? 5.6 : 3.4} align="left" />
        <p style={{ ...caps, fontSize: story ? "4cqw" : "3.2cqw", letterSpacing: "0.24em", color: background.accent_color }}>
          Consign
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          left: "6cqw",
          right: "6cqw",
          top: story ? "20%" : "20%",
          bottom: story ? "26cqw" : "8cqw",
          display: "flex",
          flexDirection: "column",
          gap: `${3.4 * unit}cqw`,
        }}
      >
        <p style={{ ...caps, fontWeight: 700, fontSize: `${(story ? 12 : 10) * fit}cqw`, letterSpacing: "0.04em", lineHeight: 0.98 }}>
          We&apos;re searching for
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: `${2.4 * fit}cqw` }}>
          {rows.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "3cqw",
                borderBottom: `0.3cqw solid color-mix(in srgb, ${background.text_color} 40%, transparent)`,
                paddingBottom: `${1.8 * fit}cqw`,
              }}
            >
              <span style={{ ...caps, fontSize: `${(story ? 5.2 : 4.2) * fit}cqw`, letterSpacing: "0.14em" }}>{item.label}</span>
              {item.detail ? (
                <span style={{ ...caps, fontSize: `${(story ? 4 : 3.2) * fit}cqw`, letterSpacing: "0.14em", color: background.accent_color, whiteSpace: "nowrap" }}>
                  {item.detail}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {note.trim() ? (
          <p style={{ ...caps, marginTop: "auto", fontSize: story ? "4cqw" : "3.2cqw", letterSpacing: "0.2em", color: background.accent_color }}>
            {note}
          </p>
        ) : null}
      </div>

      {story ? (
        <div
          data-export-ignore="true"
          style={{
            ...caps,
            position: "absolute",
            left: "19%",
            right: "19%",
            bottom: "7cqw",
            padding: "3cqw 0 2.6cqw",
            border: `0.5cqw dashed ${background.text_color}`,
            borderRadius: "3cqw",
            opacity: 0.55,
            textAlign: "center",
            fontSize: "3.6cqw",
            letterSpacing: "0.12em",
          }}
        >
          Link sticker
        </div>
      ) : null}
    </>
  )
}

export const WantsStory = forwardRef<HTMLDivElement, Props>(function WantsStory(props, ref) {
  return (
    <div ref={ref} className={props.className} style={frame(props.background, "9 / 16")}>
      <WantsLayout {...props} story />
    </div>
  )
})

export const WantsCard = forwardRef<HTMLDivElement, Props>(function WantsCard(props, ref) {
  return (
    <div ref={ref} className={props.className} style={frame(props.background, "4 / 5")}>
      <WantsLayout {...props} story={false} />
    </div>
  )
})
