import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildInstagramMediaContainerBody,
  resolveInstagramPublishMediaKind,
} from "./meta-publisher"

test("resolveInstagramPublishMediaKind sniffs video extensions from URL", () => {
  assert.equal(
    resolveInstagramPublishMediaKind("https://cdn.example.com/clip.mp4"),
    "video"
  )
  assert.equal(
    resolveInstagramPublishMediaKind(
      "https://cdn.example.com/clip.MOV?token=abc"
    ),
    "video"
  )
  assert.equal(
    resolveInstagramPublishMediaKind("https://cdn.example.com/look.jpg"),
    "image"
  )
})

test("resolveInstagramPublishMediaKind prefers explicit media kind / MIME", () => {
  assert.equal(
    resolveInstagramPublishMediaKind("https://cdn.example.com/asset", "video"),
    "video"
  )
  assert.equal(
    resolveInstagramPublishMediaKind(
      "https://cdn.example.com/asset.mp4",
      "image/jpeg"
    ),
    "image"
  )
  assert.equal(
    resolveInstagramPublishMediaKind(
      "https://cdn.example.com/asset",
      "video/mp4"
    ),
    "video"
  )
  assert.equal(
    resolveInstagramPublishMediaKind("https://cdn.example.com/asset", "REELS"),
    "video"
  )
})

test("buildInstagramMediaContainerBody uses image_url for feed photos", () => {
  const body = buildInstagramMediaContainerBody({
    mediaUrl: "https://cdn.example.com/look.jpg",
    caption: "Hello",
    placement: "feed",
  })
  assert.equal(body.image_url, "https://cdn.example.com/look.jpg")
  assert.equal(body.video_url, undefined)
  assert.equal(body.caption, "Hello")
  assert.equal(body.media_type, undefined)
})

test("buildInstagramMediaContainerBody uses video_url + REELS for feed video", () => {
  const body = buildInstagramMediaContainerBody({
    mediaUrl: "https://cdn.example.com/clip.mp4",
    caption: "Drop",
    placement: "feed",
  })
  assert.equal(body.video_url, "https://cdn.example.com/clip.mp4")
  assert.equal(body.image_url, undefined)
  assert.equal(body.caption, "Drop")
  assert.equal(body.media_type, "REELS")
})

test("buildInstagramMediaContainerBody uses video_url + STORIES for story video", () => {
  const body = buildInstagramMediaContainerBody({
    mediaUrl: "https://cdn.example.com/clip.mp4",
    caption: "ignored for stories",
    placement: "story",
  })
  assert.equal(body.video_url, "https://cdn.example.com/clip.mp4")
  assert.equal(body.image_url, undefined)
  assert.equal(body.caption, undefined)
  assert.equal(body.media_type, "STORIES")
})

test("buildInstagramMediaContainerBody keeps STORIES + image_url for story photos", () => {
  const body = buildInstagramMediaContainerBody({
    mediaUrl: "https://cdn.example.com/frame.png",
    caption: "ignored",
    placement: "story",
  })
  assert.equal(body.image_url, "https://cdn.example.com/frame.png")
  assert.equal(body.video_url, undefined)
  assert.equal(body.media_type, "STORIES")
})
