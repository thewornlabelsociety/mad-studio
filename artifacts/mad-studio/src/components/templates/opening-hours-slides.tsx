import { forwardRef } from "react"

import { kitCaps as caps, kitFrame as frame, KitWordmark as Wordmark } from "@/components/templates/kit-type"
import type { StoryBackground } from "@/lib/brands/story-kit"
import type { WeekRow } from "@/lib/templates/wls-opening-hours"

/** One day's hours, as the words on the post; every line is editable. */
export type TodayHours = {
  /** e.g. OPEN TODAY, or the public holiday's name. */
  kicker: string
  day: string
  date: string
  /** e.g. 10am – 5pm, or Closed. */
  hours: string
  /** e.g. Late night, or Back Tuesday 11:30am – 3pm. */
  note: string
}

export type HoursPost =
  | { mode: "today"; today: TodayHours; location: string }
  | { mode: "week"; rows: WeekRow[]; footnote: string; location: string }

type Props = {
  background: StoryBackground
  brandName: string
  post: HoursPost
  /** Story only: leave the dashed zone for a link sticker. */
  linkSpace?: boolean
  className?: string
}

function TodayLayout({ background, today, story }: { background: StoryBackground; today: TodayHours; story: boolean }) {
  const closed = /^closed$/i.test(today.hours.trim())
  return (
    <div style={{ display: "grid", gap: story ? "3.4cqw" : "2.2cqw" }}>
      {today.kicker.trim() ? (
        <p style={{ ...caps, fontSize: story ? "4.8cqw" : "3.6cqw", letterSpacing: "0.3em", color: background.accent_color }}>
          {today.kicker}
        </p>
      ) : null}
      <div>
        <p style={{ ...caps, fontWeight: 700, fontSize: story ? "15cqw" : "11cqw", letterSpacing: "0.04em", lineHeight: 0.98 }}>
          {today.day}
        </p>
        {today.date.trim() ? (
          <p style={{ ...caps, marginTop: story ? "2cqw" : "1.2cqw", fontSize: story ? "4.6cqw" : "3.6cqw", letterSpacing: "0.24em" }}>
            {today.date}
          </p>
        ) : null}
      </div>
      <div
        style={{
          borderTop: `0.3cqw solid ${background.text_color}`,
          paddingTop: story ? "4.4cqw" : "3cqw",
          display: "grid",
          gap: story ? "2.6cqw" : "1.8cqw",
        }}
      >
        <p
          style={{
            ...caps,
            fontWeight: 600,
            fontSize: `${(story ? 11 : 8.6) * (today.hours.length > 14 ? 0.8 : 1)}cqw`,
            letterSpacing: "0.06em",
            lineHeight: 1,
            opacity: closed ? 0.85 : 1,
          }}
        >
          {today.hours || "Hours"}
        </p>
        {today.note.trim() ? (
          <p style={{ ...caps, fontSize: story ? "4.4cqw" : "3.4cqw", letterSpacing: "0.18em", color: background.accent_color }}>
            {today.note}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function WeekLayout({
  background,
  rows,
  footnote,
  location,
  story,
}: {
  background: StoryBackground
  rows: WeekRow[]
  footnote: string
  location: string
  story: boolean
}) {
  const text = story ? 4.6 : 3.7
  return (
    <div style={{ display: "grid", gap: story ? "4.6cqw" : "2.4cqw" }}>
      <p style={{ ...caps, fontWeight: 700, fontSize: story ? "11cqw" : "7.6cqw", letterSpacing: "0.04em", lineHeight: 0.98 }}>
        Opening hours
      </p>
      <div style={{ borderTop: `0.3cqw solid ${background.text_color}`, paddingTop: story ? "3cqw" : "2cqw" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              alignItems: "baseline",
              gap: "4cqw",
              padding: story ? "2.3cqw 0" : "1.1cqw 0",
              borderBottom: `0.15cqw solid ${background.text_color}33`,
              opacity: row.closed ? 0.6 : 1,
            }}
          >
            <p style={{ ...caps, fontWeight: 600, fontSize: `${text}cqw`, letterSpacing: "0.2em" }}>{row.label}</p>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...caps, fontSize: `${text}cqw`, letterSpacing: "0.12em" }}>{row.closed ? "Closed" : row.hours}</p>
              {row.note ? (
                <p
                  style={{
                    ...caps,
                    marginTop: "0.6cqw",
                    fontSize: `${text * 0.66}cqw`,
                    letterSpacing: "0.24em",
                    color: background.accent_color,
                  }}
                >
                  {row.note}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {footnote.trim() ? (
        <p style={{ ...caps, fontSize: story ? "3.4cqw" : "2.6cqw", letterSpacing: "0.16em", color: background.accent_color, lineHeight: 1.35 }}>
          {footnote}
        </p>
      ) : null}
      {location.trim() ? <Location location={location} story={story} /> : null}
    </div>
  )
}

function Location({ location, story }: { location: string; story: boolean }) {
  return (
    <p style={{ ...caps, fontSize: story ? "3.4cqw" : "2.5cqw", letterSpacing: "0.22em", opacity: 0.8 }}>
      {location}
    </p>
  )
}

function HoursLayout({ background, brandName, post, linkSpace, story }: Props & { story: boolean }) {
  const sticker = story && linkSpace
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: story ? "5.5cqw 6cqw auto" : "5.5cqw 6cqw auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Wordmark brandName={brandName} accent={background.accent_color} size={story ? 5.6 : 3.2} align="left" />
        <p style={{ ...caps, fontSize: story ? "4cqw" : "2.8cqw", letterSpacing: "0.24em", color: background.accent_color }}>
          Hours
        </p>
      </div>

      <div
        style={{
          position: "absolute",
          left: "6cqw",
          right: "6cqw",
          top: story ? (post.mode === "week" ? "54%" : "50%") : "53%",
          transform: sticker ? "translateY(-56%)" : "translateY(-50%)",
        }}
      >
        {post.mode === "today" ? (
          <TodayLayout background={background} today={post.today} story={story} />
        ) : (
          <WeekLayout background={background} rows={post.rows} footnote={post.footnote} location={post.location} story={story} />
        )}
      </div>

      {post.mode === "today" && post.location.trim() ? (
        <p
          style={{
            ...caps,
            position: "absolute",
            left: "6cqw",
            right: "6cqw",
            bottom: sticker ? "27cqw" : story ? "8cqw" : "5cqw",
            textAlign: "center",
            fontSize: story ? "3.4cqw" : "2.5cqw",
            letterSpacing: "0.22em",
            opacity: 0.8,
          }}
        >
          {post.location}
        </p>
      ) : null}

      {sticker ? (
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

/** 1080×1920 when saved. */
export const OpeningHoursStory = forwardRef<HTMLDivElement, Props>(function OpeningHoursStory(props, ref) {
  return (
    <div ref={ref} className={props.className} style={frame(props.background, "9 / 16")}>
      <HoursLayout {...props} story />
    </div>
  )
})

/** 1080×1080 when saved. */
export const OpeningHoursCard = forwardRef<HTMLDivElement, Props>(function OpeningHoursCard(props, ref) {
  return (
    <div ref={ref} className={props.className} style={frame(props.background, "1 / 1")}>
      <HoursLayout {...props} story={false} />
    </div>
  )
})
