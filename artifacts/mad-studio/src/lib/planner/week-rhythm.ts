import type { CalendarPost } from "./calendar-posts.ts"

/** What a day of the week is for, and where to make it. */
export type RhythmSlot = {
  title: string
  detail: string
  /** App path for the tool that makes it (entity query is added by the caller). */
  path: string
  /** Optional days are fine to leave empty. */
  optional?: boolean
}

/** Worn Label's weekly feed rhythm, Monday first. */
export const WLS_WEEK_RHYTHM: RhythmSlot[] = [
  { title: "A week of outfits", detail: "Carousel of seven looks from stock", path: "/templates/wls-week-outfits" },
  { title: "Short video", detail: "Try-on, rack walk or steam and tag", path: "/studio" },
  { title: "Inspo vs WLS", detail: "The look, and your version from the racks", path: "/studio" },
  { title: "Sale rack", detail: "This week's markdowns", path: "/templates/wls-sale-rack" },
  { title: "Short video", detail: "Second reel of the week", path: "/studio" },
  { title: "We're searching for", detail: "Ask for the stock you want consigned", path: "/templates/wls-wants" },
  { title: "Announcement", detail: "Only if there's news: a sale, hours or an event", path: "/templates/wls-announcement", optional: true },
]

/** Any other brand: every day open, made in Studio. */
export const OPEN_WEEK_RHYTHM: RhythmSlot[] = Array.from({ length: 7 }, () => ({
  title: "Post",
  detail: "Anything for the feed",
  path: "/studio",
  optional: true,
}))

const FEED_PLATFORMS = new Set(["instagram_feed", "facebook", "tiktok"])

/** Monday 00:00 of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** True for posts that go to the feed (not only a Story or email). */
export function isFeedPost(post: CalendarPost): boolean {
  return post.slots.some((slot) => FEED_PLATFORMS.has(slot.platform))
}

export type PlannedDay = {
  date: Date
  slot: RhythmSlot
  posts: CalendarPost[]
  state: "posted" | "planned" | "failed" | "empty"
}

/** The seven days from `weekStart`, each with its rhythm slot and feed posts. */
export function planWeek(input: {
  weekStart: Date
  posts: CalendarPost[]
  rhythm: RhythmSlot[]
}): PlannedDay[] {
  return input.rhythm.map((slot, index) => {
    const date = addDays(input.weekStart, index)
    const next = addDays(date, 1)
    const posts = input.posts.filter(
      (post) => isFeedPost(post) && post.time >= date && post.time < next
    )
    const state: PlannedDay["state"] =
      posts.length === 0
        ? "empty"
        : posts.some((post) => post.status === "failed")
          ? "failed"
          : posts.every((post) => post.status === "published")
            ? "posted"
            : "planned"
    return { date, slot, posts, state }
  })
}

/**
 * The Instagram grid as it will look at the end of the week: newest first,
 * planned posts on top of what's already up.
 */
export function gridPosts(input: { posts: CalendarPost[]; until: Date; limit?: number }): CalendarPost[] {
  return input.posts
    .filter(
      (post) =>
        post.time < input.until &&
        post.mediaUrls.length > 0 &&
        post.slots.some((slot) => slot.platform === "instagram_feed")
    )
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, input.limit ?? 12)
}
