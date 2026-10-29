import assert from "node:assert/strict"
import { test } from "node:test"

import type { CalendarPost, CalendarPostStatus } from "./calendar-posts.ts"
import { gridPosts, mondayOf, planWeek, WLS_WEEK_RHYTHM } from "./week-rhythm.ts"

function post(key: string, time: Date, platforms: string[], status: CalendarPostStatus = "scheduled"): CalendarPost {
  return {
    key,
    campaignId: null,
    title: key,
    caption: "",
    mediaUrls: [`https://example.com/${key}.png`],
    slots: platforms.map((platform, i) => ({
      id: `${key}-${i}`,
      platform,
      time,
      status,
      error: null,
      publishedAt: null,
    })),
    time,
    status,
    overdue: false,
  }
}

const monday = new Date(2026, 10, 2)

test("weeks start on Monday", () => {
  assert.equal(mondayOf(new Date(2026, 10, 5)).getDate(), 2)
  assert.equal(mondayOf(new Date(2026, 10, 8)).getDate(), 2)
  assert.equal(mondayOf(new Date(2026, 10, 2)).getDate(), 2)
})

test("each day shows its feed posts and whether it's done", () => {
  const posts = [
    post("outfits", new Date(2026, 10, 2, 9), ["instagram_feed", "facebook"], "published"),
    post("story-only", new Date(2026, 10, 3, 9), ["instagram_story"]),
    post("sale", new Date(2026, 10, 5, 12), ["instagram_feed"], "scheduled"),
    post("broken", new Date(2026, 10, 7, 12), ["instagram_feed"], "failed"),
  ]
  const week = planWeek({ weekStart: monday, posts, rhythm: WLS_WEEK_RHYTHM })
  assert.deepEqual(
    week.map((day) => day.state),
    ["posted", "empty", "empty", "planned", "empty", "failed", "empty"]
  )
  assert.equal(week[0].slot.title, "A week of outfits")
  assert.equal(week[3].posts[0].key, "sale")
})

test("the grid is newest first, Instagram feed only, up to the week's end", () => {
  const posts = [
    post("old", new Date(2026, 9, 20), ["instagram_feed"], "published"),
    post("fb-only", new Date(2026, 10, 1), ["facebook"], "published"),
    post("planned", new Date(2026, 10, 4), ["instagram_feed"]),
    post("next-week", new Date(2026, 10, 10), ["instagram_feed"]),
  ]
  const grid = gridPosts({ posts, until: new Date(2026, 10, 9), now: new Date(2026, 10, 3) })
  assert.deepEqual(grid.map((row) => row.key), ["planned", "old"])
})

test("posts that failed or were missed never reach the grid", () => {
  const posts = [
    post("failed", new Date(2026, 10, 2), ["instagram_feed"], "failed"),
    post("missed", new Date(2026, 10, 2, 9), ["instagram_feed"], "scheduled"),
    post("due", new Date(2026, 10, 5), ["instagram_feed"], "scheduled"),
  ]
  const grid = gridPosts({ posts, until: new Date(2026, 10, 9), now: new Date(2026, 10, 3) })
  assert.deepEqual(grid.map((row) => row.key), ["due"])
})
