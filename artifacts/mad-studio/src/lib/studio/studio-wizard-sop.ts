import {
  WORKBENCH_STEP_CANVAS,
  WORKBENCH_STEP_CHANNELS,
  WORKBENCH_STEP_COPY,
  WORKBENCH_STEP_INTENT,
  WORKBENCH_STEP_MEDIA,
  type WorkbenchFlowStep,
} from "@/lib/studio/workbench-steps"

export type StudioWizardStepSop = {
  /** One line under the stepper — current step only. */
  hint: string
  /** Numbered micro-SOP (tooltip / drawer). */
  checklist: string[]
}

export const STUDIO_WIZARD_STEP_SOP: Record<
  | typeof WORKBENCH_STEP_MEDIA
  | typeof WORKBENCH_STEP_INTENT
  | typeof WORKBENCH_STEP_CANVAS
  | typeof WORKBENCH_STEP_COPY
  | typeof WORKBENCH_STEP_CHANNELS,
  StudioWizardStepSop
> = {
  [WORKBENCH_STEP_MEDIA]: {
    hint: "Add at least one still or reel from the library or upload — then polish on Canvas.",
    checklist: [
      "Open Add → pick intake or uploads (carousel = 2+ stills).",
      "Select the hero clip in the tray; drag thumbnails to set carousel order; use CapCut / PhotoRoom if you need an edit.",
      "Optional: transparent cutout for Story before you leave Media.",
    ],
  },
  [WORKBENCH_STEP_INTENT]: {
    hint: "Audience tone + post focus + what it is about (retail). FÜDI: drop type & vibe. Hook/CTA on Schedule.",
    checklist: [
      "Pick audience tone (who you are talking to).",
      "Pick post focus chips (e.g. Drive Sales vs Build Hype).",
      "Set what the post is about — entity content pillar or custom line.",
      "FÜDI: drop type and listing vibe. Optional: expand Advanced for persona/hook/CTA.",
      "Formula hook + CTA: Schedule step when you render a $0 pack.",
    ],
  },
  [WORKBENCH_STEP_CANVAS]: {
    hint: "Story tools (cutout, CapCut, PhotoRoom) + drag on-image text — caption on Copy.",
    checklist: [
      "Use **Story tools**: CapCut, PhotoRoom, and **Cut out item** for IG Story.",
      "After cutout, set Story card background, item size, and position.",
      "Move headline/subhead by dragging the dashed box on preview; corner handles rotate and scale.",
      "Review **Add on your phone after publish** — link, music, poll (native only).",
    ],
  },
  [WORKBENCH_STEP_COPY]: {
    hint: "Brain hooks for opening line; Suggest with AI for caption (media + Intent).",
    checklist: [
      "Tap an opening line from Brain (built from media + Intent) — no duplicate hook AI.",
      "Caption: Suggest with AI uses vision, pillar, persona, CTA, and on-canvas text.",
      "Use AI assist or formula slots for $0 render packs.",
      "Confirm trackable destination / spark text before scheduling.",
    ],
  },
  [WORKBENCH_STEP_CHANNELS]: {
    hint: "Track 1: Feed/FB → Confirm & publish live. Track 2: Story/TikTok → download + phone drop.",
    checklist: [
      "Switch channel rail to match where you are posting.",
      "Track 1 (IG Feed, Facebook): review 4:5 → Confirm & publish live.",
      "Track 2 (IG Story, TikTok): Download ready media → Copy link sticker URL → post on phone with native stickers.",
      "Optional: arm multi-channel rows; finish on Today or Campaigns.",
    ],
  },
}

export function studioWizardSopForStep(
  step: WorkbenchFlowStep
): StudioWizardStepSop | null {
  if (step === WORKBENCH_STEP_MEDIA) return STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_MEDIA]
  if (step === WORKBENCH_STEP_INTENT) return STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_INTENT]
  if (step === WORKBENCH_STEP_CANVAS) return STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_CANVAS]
  if (step === WORKBENCH_STEP_COPY) return STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_COPY]
  if (step === WORKBENCH_STEP_CHANNELS)
    return STUDIO_WIZARD_STEP_SOP[WORKBENCH_STEP_CHANNELS]
  return null
}

export type TeamPostingTrackSop = {
  id: "autopilot" | "draft_drop"
  title: string
  intro?: string
  steps: string[]
  stickerBullets?: string[]
}

export const TEAM_POSTING_TRACK_SOPS: TeamPostingTrackSop[] = [
  {
    id: "autopilot",
    title: "Track 1: 100% autopilot (Instagram feed & Facebook)",
    steps: [
      "Select the draft or pull new arrivals in MAD Studio.",
      "Review copy, vibe, and 4:5 preview in the simulator.",
      "Click Confirm & publish live. Done.",
    ],
  },
  {
    id: "draft_drop",
    title: "Track 2: 45-second draft & drop (Stories & Reels)",
    intro:
      "Instagram and TikTok block third-party apps from attaching native music, polls, or clickable links.",
    steps: [
      "Click Download ready media in MAD Studio.",
      "Click Copy link sticker URL.",
      "Open Instagram on your phone → Story/Reel → pick the downloaded media.",
      "Tap Sticker tray for music, poll, or link (details below).",
      "Tap Share. (Live in ~30 seconds with native reach.)",
    ],
    stickerBullets: [
      "Music: tap Music and choose a trending sound.",
      "Poll: tap Poll and enter your question.",
      "Link: tap Link, paste your shortlink, label it (Order Now / View Piece).",
    ],
  },
]

export const STUDIO_SOP_DRAWER_INTRO =
  "MAD Studio is your creative director — hooks, visuals, and trackable links. Native IG/TikTok stickers are always added on your phone."

/** Shown on Canvas — features Meta/TikTok only allow in-app (not baked into export). */
export type CanvasNativePostFeature = {
  id: string
  title: string
  detail: string
  platforms: string[]
}

export const CANVAS_NATIVE_POST_FEATURES: CanvasNativePostFeature[] = [
  {
    id: "link",
    title: "Link sticker",
    detail:
      "Story / Reels / TikTok: tap Link, paste your trackable URL, label it (Order now, View menu).",
    platforms: ["Story", "Reels", "TikTok"],
  },
  {
    id: "music",
    title: "Music & audio",
    detail:
      "Choose a trending sound in-app. On Schedule, use No audio (add in-app) before download if you want a clean slate.",
    platforms: ["Reels", "TikTok", "Story"],
  },
  {
    id: "poll",
    title: "Poll · quiz · questions",
    detail: "Engagement stickers live only on the platform — never in the exported PNG.",
    platforms: ["Story", "Reels"],
  },
  {
    id: "location",
    title: "Location",
    detail: "Place sticker or location field for local discovery (FÜDI drops, store events).",
    platforms: ["Feed", "Story", "Reels"],
  },
  {
    id: "mentions",
    title: "Mentions & product tags",
    detail: "@ partners, collaborators, and IG product tags where your catalog is connected.",
    platforms: ["Feed", "Story"],
  },
  {
    id: "collab",
    title: "Collab · Add Yours",
    detail: "Co-author invites and community prompts — attach when you publish from your phone.",
    platforms: ["Feed", "Reels"],
  },
]
