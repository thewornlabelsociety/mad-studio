import { forwardRef, type CSSProperties } from "react"

import { EditorialAnnouncement, type EditorialAccent } from "@/components/templates/editorial-announcement"
import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"

export type Announcement = {
  /** Small label top right, e.g. NEWS, SALE, EVENT. */
  tag: string
  /** Line above the headline, e.g. THIS FRIDAY. */
  kicker: string
  headline: string
  /** Up to three short lines: when, where, what (four on Editorial). */
  details: string[]
  /** Kit: Josefin capitals. Editorial: the moodboard's serif and script. */
  style?: "kit" | "editorial"
  /** Editorial: a signature-script line under the headline. */
  script?: string
  /** Editorial: headline in the tall serif or the script. */
  headlineFont?: "serif" | "script"
  accent?: EditorialAccent
  align?: "center" | "left"
  /** A photo behind the words instead of the plain colour (an image-proxy path). */
  photo?: string
  /** How much to darken (light words) or lighten (dark words) the photo, 0-80. */
  photoShade?: number
  photoText?: "light" | "dark"
}

/** With a photo, the words switch to white (or near black) so they read on it. */
function groundFor(background: StoryBackground, announcement: Announcement): StoryBackground {
  if (!announcement.photo) return background
  return announcement.photoText === "dark"
    ? { ...background, color: "#F4F1EA", text_color: "#1A1A1A", accent_color: "#1A1A1A" }
    : { ...background, color: "#2A2A2A", text_color: "#FFFFFF", accent_color: "#F1EADB" }
}

/** The photo, filling the frame, with a wash so the words stay readable. */
function PhotoBackdrop({ announcement }: { announcement: Announcement }) {
  if (!announcement.photo) return null
  const shade = Math.min(80, Math.max(0, announcement.photoShade ?? 35)) / 100
  const fill: CSSProperties = { position: "absolute", inset: 0, zIndex: -1 }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={announcement.photo} alt="" crossOrigin="anonymous" draggable={false} style={{ ...fill, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ ...fill, background: announcement.photoText === "dark" ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${shade})` }} />
    </>
  )
}

type Props = {
  background: StoryBackground
  brandName: string
  announcement: Announcement
  /** Story only: leave the dashed zone for a link sticker. */
  linkSpace?: boolean
  className?: string
}

/** Headline size in cqw: big for a few words, smaller as it grows. */
function headlineSize(text: string, story: boolean): number {
  const longest = Math.max(...text.split(/\s+/).map((word) => word.length), 1)
  const base = story ? 15 : 13
  const byLength = text.length > 40 ? 0.62 : text.length > 26 ? 0.76 : text.length > 14 ? 0.9 : 1
  // Keep the longest word on one line.
  const byWord = Math.min(1, 9 / longest)
  return base * Math.min(byLength, byWord + 0.12)
}

function AnnouncementLayout({ background, brandName, announcement, linkSpace, story }: Props & { story: boolean }) {
  if (announcement.style === "editorial") {
    return (
      <EditorialAnnouncement
        background={background}
        brandName={brandName}
        announcement={announcement}
        story={story}
        linkSpace={linkSpace}
      />
    )
  }
  const { tag, kicker, headline, details } = announcement
  const lines = details.map((line) => line.trim()).filter(Boolean)
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
        {tag.trim() ? (
          <p style={{ ...caps, fontSize: story ? "4cqw" : "3.2cqw", letterSpacing: "0.24em", color: background.accent_color }}>
            {tag}
          </p>
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: "6cqw",
          right: "6cqw",
          top: "50%",
          transform: story && linkSpace ? "translateY(-58%)" : "translateY(-50%)",
          display: "grid",
          gap: story ? "4cqw" : "3.2cqw",
        }}
      >
        {kicker.trim() ? (
          <p style={{ ...caps, fontSize: story ? "4.8cqw" : "4cqw", letterSpacing: "0.3em", color: background.accent_color }}>
            {kicker}
          </p>
        ) : null}
        <p
          style={{
            ...caps,
            fontWeight: 700,
            fontSize: `${headlineSize(headline, story)}cqw`,
            letterSpacing: "0.04em",
            lineHeight: 0.98,
            textWrap: "balance",
          }}
        >
          {headline || "Your headline"}
        </p>
        {lines.length > 0 ? (
          <div
            style={{
              borderTop: `0.3cqw solid ${background.text_color}`,
              paddingTop: story ? "4cqw" : "3cqw",
              display: "grid",
              gap: story ? "2.4cqw" : "1.8cqw",
            }}
          >
            {lines.slice(0, 3).map((line) => (
              <p key={line} style={{ ...caps, fontSize: story ? "4.6cqw" : "3.6cqw", letterSpacing: "0.18em" }}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {story && linkSpace ? (
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

export const AnnouncementStory = forwardRef<HTMLDivElement, Props>(function AnnouncementStory(props, ref) {
  const background = groundFor(props.background, props.announcement)
  return (
    <div ref={ref} className={props.className} style={{ ...frame(background, "9 / 16"), isolation: "isolate" }}>
      <PhotoBackdrop announcement={props.announcement} />
      <AnnouncementLayout {...props} background={background} story />
    </div>
  )
})

export const AnnouncementCard = forwardRef<HTMLDivElement, Props>(function AnnouncementCard(props, ref) {
  const background = groundFor(props.background, props.announcement)
  return (
    <div ref={ref} className={props.className} style={{ ...frame(background), isolation: "isolate" }}>
      <PhotoBackdrop announcement={props.announcement} />
      <AnnouncementLayout {...props} background={background} story={false} />
    </div>
  )
})
