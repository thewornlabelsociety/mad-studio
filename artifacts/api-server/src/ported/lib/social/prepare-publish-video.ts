import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

import { createAdminClient } from "@/lib/supabase/admin"
import type { VideoAudioMode } from "@/lib/social/types"
import { isPublicHttpUrl } from "@/lib/social/types"
import { isPublishVideoUrl } from "@/lib/social/video-media"

const execFileAsync = promisify(execFile)

let ffmpegAvailable: boolean | null = null

async function detectFfmpeg(): Promise<boolean> {
  if (ffmpegAvailable != null) return ffmpegAvailable
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 8_000 })
    ffmpegAvailable = true
  } catch {
    ffmpegAvailable = false
  }
  return ffmpegAvailable
}

async function uploadMp4ToEntityAssets(input: {
  entityId: string
  buffer: Buffer
  filenameHint: string
}): Promise<string> {
  const admin = createAdminClient()
  const safeHint = input.filenameHint.replace(/[^\w.\-]+/g, "_").slice(0, 48)
  const path = `media/${input.entityId}/social_${Date.now()}_${safeHint}.mp4`

  const { error } = await admin.storage.from("entity-assets").upload(path, input.buffer, {
    contentType: "video/mp4",
    upsert: false,
  })
  if (error) {
    throw new Error(`Failed to upload prepared video: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("entity-assets").getPublicUrl(path)

  if (!isPublicHttpUrl(publicUrl)) {
    throw new Error("Prepared video did not resolve to a public HTTPS URL.")
  }
  return publicUrl
}

async function runFfmpeg(args: string[]): Promise<void> {
  await execFileAsync("ffmpeg", args, { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
}

export type PreparePublishVideoResult =
  | {
      ok: true
      url: string
      transformed: boolean
      note?: string
    }
  | { ok: false; error: string }

/**
 * Strip audio or re-encode AAC before social APIs pull the file.
 * When `optimizeAudioForTikTok` is false and mode is preserve, returns the original URL.
 */
export async function prepareVideoForSocialPublish(input: {
  mediaUrl: string
  entityId: string
  audioMode: VideoAudioMode
  optimizeAudioForTikTok?: boolean
}): Promise<PreparePublishVideoResult> {
  const mediaUrl = input.mediaUrl.trim()
  if (!isPublishVideoUrl(mediaUrl)) {
    return { ok: true, url: mediaUrl, transformed: false }
  }

  const needsTransform =
    input.audioMode === "mute" || Boolean(input.optimizeAudioForTikTok)
  if (!needsTransform) {
    return { ok: true, url: mediaUrl, transformed: false }
  }

  const hasFfmpeg = await detectFfmpeg()
  if (!hasFfmpeg) {
    if (input.audioMode === "mute") {
      return {
        ok: false,
        error:
          "Server cannot strip audio (ffmpeg missing). Choose “Keep audio” or mute the reel in CapCut before upload.",
      }
    }
    return {
      ok: true,
      url: mediaUrl,
      transformed: false,
      note: "ffmpeg not installed — sending original file audio unchanged.",
    }
  }

  let workDir: string | null = null
  try {
    const response = await fetch(mediaUrl, { cache: "no-store" })
    if (!response.ok) {
      return {
        ok: false,
        error: `Could not download video for publish prep (${response.status}).`,
      }
    }
    const source = Buffer.from(await response.arrayBuffer())
    if (!source.length) {
      return { ok: false, error: "Video file was empty." }
    }

    workDir = await mkdtemp(join(tmpdir(), "mad-social-vid-"))
    const inputPath = join(workDir, "in.bin")
    const outputPath = join(workDir, "out.mp4")
    await writeFile(inputPath, source)

    const muteArgs = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "copy",
      "-an",
      "-movflags",
      "+faststart",
      outputPath,
    ]
    const preserveArgs = [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      outputPath,
    ]

    try {
      await runFfmpeg(input.audioMode === "mute" ? muteArgs : preserveArgs)
    } catch {
      const fallbackArgs =
        input.audioMode === "mute"
          ? [
              "-y",
              "-i",
              inputPath,
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "23",
              "-an",
              "-movflags",
              "+faststart",
              outputPath,
            ]
          : [
              "-y",
              "-i",
              inputPath,
              "-c:v",
              "libx264",
              "-preset",
              "fast",
              "-crf",
              "23",
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-ar",
              "44100",
              "-ac",
              "2",
              "-movflags",
              "+faststart",
              outputPath,
            ]
      await runFfmpeg(fallbackArgs)
    }

    const outBuffer = await readFile(outputPath)
    if (!outBuffer.length) {
      return { ok: false, error: "Video prep produced an empty file." }
    }

    const hint = input.audioMode === "mute" ? "muted" : "aac"
    const publicUrl = await uploadMp4ToEntityAssets({
      entityId: input.entityId,
      buffer: outBuffer,
      filenameHint: hint,
    })

    return {
      ok: true,
      url: publicUrl,
      transformed: true,
      note:
        input.audioMode === "mute"
          ? "Silent MP4 — add music in the social app."
          : "Re-encoded audio to AAC for TikTok.",
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Video preparation failed.",
    }
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

/** @deprecated Use prepareVideoForSocialPublish with optimizeAudioForTikTok. */
export async function prepareTikTokVideoForPublish(input: {
  mediaUrl: string
  entityId: string
  audioMode: VideoAudioMode
}): Promise<PreparePublishVideoResult> {
  return prepareVideoForSocialPublish({
    ...input,
    optimizeAudioForTikTok: input.audioMode === "preserve",
  })
}
