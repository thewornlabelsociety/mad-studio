import { test } from "node:test"
import assert from "node:assert/strict"

import { fetchShopCallouts, parseShopCalloutFeed, shopCalloutFeedUrl } from "./shop-callouts.ts"

const good = {
  id: 7,
  template: "wanted-edit",
  sentAt: "2026-11-25T03:00:00.000Z",
  title: "Wanted: Denim shorts",
  kicker: "The Wanted Edit",
  headline: "What our rails",
  headlineAccent: "are missing",
  message: "Our rails are light on denim shorts.",
  items: [{ label: "Denim shorts", audience: "women", typeKey: "denim-shorts" }],
  images: ["https://pub.r2.dev/a.jpg"],
  links: {
    book: "https://www.wornlabelsociety.co.nz/consign/book",
    online: "https://www.wornlabelsociety.co.nz/join?intent=sell",
    join: "https://www.wornlabelsociety.co.nz/join",
    shop: "https://www.wornlabelsociety.co.nz/shop",
  },
  nextDropOff: "2027-01-19",
  leadOnline: true,
  caption: "Wanted: Denim shorts.",
}

test("feed URL comes from the shop's website setting, or an override", () => {
  assert.equal(shopCalloutFeedUrl({}), "https://www.wornlabelsociety.co.nz/api/public/callouts/feed")
  assert.equal(shopCalloutFeedUrl({ WLS_WEBSITE_URL: "https://staging.example.test/" }), "https://staging.example.test/api/public/callouts/feed")
  assert.equal(shopCalloutFeedUrl({ WLS_CALLOUT_FEED_URL: "http://localhost:5001/api/public/callouts/feed" }), "http://localhost:5001/api/public/callouts/feed")
})

test("parses the feed, newest first, and skips rows that don't fit", () => {
  const older = { ...good, id: 6, sentAt: "2026-11-01T00:00:00.000Z" }
  const broken = { ...good, id: 8, images: ["javascript:alert(1)"] }
  const list = parseShopCalloutFeed({ callouts: [older, broken, good] })
  assert.deepEqual(list.map((c) => c.id), [7, 6])
  assert.deepEqual(parseShopCalloutFeed(null), [])
  assert.deepEqual(parseShopCalloutFeed({ callouts: "nope" }), [])
})

test("fetch reports plain-English problems", async () => {
  const json = (body: unknown, status = 200, type = "application/json") =>
    (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": type } })) as typeof fetch
  const ok = await fetchShopCallouts({ fetchImpl: json({ callouts: [good] }), env: {} })
  assert.ok(ok.ok && ok.callouts.length === 1)
  const down = await fetchShopCallouts({ fetchImpl: json({}, 503), env: {} })
  assert.ok(!down.ok && /503/.test(down.error))
  const html = await fetchShopCallouts({ fetchImpl: json("<html>", 200, "text/html"), env: {} })
  assert.ok(!html.ok && /isn't live yet/.test(html.error))
  const offline = await fetchShopCallouts({ fetchImpl: (async () => { throw new Error("ECONNREFUSED") }) as typeof fetch, env: {} })
  assert.ok(!offline.ok && /Couldn't reach/.test(offline.error))
})
