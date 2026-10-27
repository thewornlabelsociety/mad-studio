import assert from "node:assert/strict"
import { test } from "node:test"

import type { MediaAsset } from "@/components/marketing/media-tray"
import { DEFAULT_STORY_PREVIEW } from "@/components/marketing/multi-platform-simulator"
import { DEFAULT_CANVAS_TEXT_OVERLAY } from "@/lib/studio/canvas-text-types"
import {
  buildCreativeSequence,
  buildVisualOnlyCampaignPack,
  creativeSequenceRoundTrip,
  parseCreativeSequence,
  restoreCreativeSequence,
} from "@/lib/studio/creative-sequence.ts"
import { campaignPackSchema } from "@/lib/campaigns/pack-schema.ts"

function frame(
  id: string,
  productId: string,
  url: string,
  headline: string
): { asset: MediaAsset; overlay: typeof DEFAULT_CANVAS_TEXT_OVERLAY } {
  return {
    asset: {
      id,
      url,
      publicUrl: url,
      type: "image",
      marketingEntityId: productId,
      destinationUrl: `https://www.wornlabelsociety.co.nz/marketplace/listings/${productId}`,
      intakeCaption: `Caption ${id}`,
    },
    overlay: {
      ...DEFAULT_CANVAS_TEXT_OVERLAY,
      headline,
      enabled: true,
    },
  }
}

test("five-frame save/restore round-trip keeps order, overlays, products, URLs", () => {
  const frames = [
    frame("a", "prod-a", "https://cdn.example/a.jpg", "One"),
    frame("b", "prod-b", "https://cdn.example/b.jpg", "Two"),
    frame("c", "prod-c", "https://cdn.example/c.jpg", "Three"),
    frame("d", "prod-d", "https://cdn.example/d.jpg", "Four"),
    frame("e", "prod-e", "https://cdn.example/e.jpg", "Five"),
  ]
  const slideOverlays = Object.fromEntries(
    frames.map((row) => [row.asset.id, row.overlay])
  )
  const restored = creativeSequenceRoundTrip({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays,
    storyPreview: {
      ...DEFAULT_STORY_PREVIEW,
      canvasColor: "#F5F0E8",
      cutoutMode: "transparent",
      subjectScale: 1.2,
    },
    surface: "story",
    activeChannel: "ig_story",
    templateInstanceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    templateVersionId: "3",
    visualOnly: true,
    rawSpark: "Daily arrivals",
  })
  assert.ok(restored)
  assert.equal(restored!.mediaAssets.length, 5)
  assert.deepEqual(
    restored!.mediaAssets.map((row) => row.id),
    ["a", "b", "c", "d", "e"]
  )
  assert.equal(restored!.slideOverlays.a?.headline, "One")
  assert.equal(restored!.slideOverlays.e?.headline, "Five")
  assert.equal(restored!.mediaAssets[2]?.marketingEntityId, "prod-c")
  assert.equal(
    restored!.mediaAssets[2]?.destinationUrl,
    "https://www.wornlabelsociety.co.nz/marketplace/listings/prod-c"
  )
  assert.equal(restored!.storyPreview.canvasColor, "#F5F0E8")
  assert.equal(restored!.storyPreview.subjectScale, 1.2)
  assert.equal(restored!.templateInstanceId, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  assert.equal(restored!.templateVersionId, "3")
  assert.equal(restored!.visualOnly, true)
  assert.equal(restored!.surface, "story")
})

test("independent overlay persistence per frame", () => {
  const frames = [
    frame("a", "p1", "https://cdn.example/a.jpg", "Alpha"),
    frame("b", "p2", "https://cdn.example/b.jpg", "Beta"),
  ]
  const built = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: {
      a: frames[0]!.overlay,
      b: frames[1]!.overlay,
    },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "story",
    activeChannel: "ig_story",
    visualOnly: true,
  })
  assert.ok(built)
  const again = parseCreativeSequence(JSON.parse(JSON.stringify(built)))
  assert.ok(again)
  assert.notEqual(again!.frames[0]!.overlay.headline, again!.frames[1]!.overlay.headline)
  const restored = restoreCreativeSequence(again!)
  assert.equal(restored.slideOverlays.a?.headline, "Alpha")
  assert.equal(restored.slideOverlays.b?.headline, "Beta")
})

test("visual-only pack passes campaignPackSchema without AI copy", () => {
  const pack = buildVisualOnlyCampaignPack({
    title: "WLS · 5-frame Story",
    captionHint: "",
    frameCount: 5,
  })
  const parsed = campaignPackSchema.safeParse(pack)
  assert.equal(parsed.success, true)
  assert.match(pack.campaign_title, /Story/)
})

test("sold products are flagged on restore without dropping frames", () => {
  const frames = [
    frame("a", "prod-a", "https://cdn.example/a.jpg", "One"),
    frame("b", "prod-b", "https://cdn.example/b.jpg", "Two"),
  ]
  const built = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: {
      a: frames[0]!.overlay,
      b: frames[1]!.overlay,
    },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "story",
    activeChannel: "ig_story",
    visualOnly: true,
    availabilityByProductId: { "prod-a": "available", "prod-b": "sold" },
  })
  assert.ok(built)
  const restored = restoreCreativeSequence(built!, {
    "prod-a": "available",
    "prod-b": "sold",
  })
  assert.equal(restored.mediaAssets.length, 2)
  assert.deepEqual(restored.soldProductIds, ["prod-b"])
})

test("resave payload keeps same template ids (template unchanged by campaign save)", () => {
  const frames = [frame("a", "p1", "https://cdn.example/a.jpg", "Keep")]
  const first = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: { a: frames[0]!.overlay },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "story",
    activeChannel: "ig_story",
    templateInstanceId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    templateVersionId: "7",
    visualOnly: true,
  })
  assert.ok(first)
  const second = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: {
      a: { ...frames[0]!.overlay, headline: "Edited" },
    },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "story",
    activeChannel: "ig_story",
    templateInstanceId: first!.templateInstanceId,
    templateVersionId: first!.templateVersionId,
    visualOnly: true,
  })
  assert.ok(second)
  assert.equal(second!.templateInstanceId, first!.templateInstanceId)
  assert.equal(second!.templateVersionId, first!.templateVersionId)
  assert.equal(second!.frames[0]!.overlay.headline, "Edited")
})

test("feed vs story surface is preserved explicitly", () => {
  const frames = [frame("a", "p1", "https://cdn.example/a.jpg", "Feed")]
  const story = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: { a: frames[0]!.overlay },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "story",
    activeChannel: "ig_story",
    visualOnly: true,
  })
  const feed = buildCreativeSequence({
    mediaAssets: frames.map((row) => row.asset),
    slideOverlays: { a: frames[0]!.overlay },
    storyPreview: DEFAULT_STORY_PREVIEW,
    surface: "feed",
    activeChannel: "ig_feed",
    visualOnly: false,
  })
  assert.equal(story?.surface, "story")
  assert.equal(feed?.surface, "feed")
  assert.equal(feed?.visualOnly, false)
})
