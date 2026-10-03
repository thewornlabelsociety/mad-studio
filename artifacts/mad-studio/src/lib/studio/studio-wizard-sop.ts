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
    hint: "Add at least one still or reel from the library or upload — preview starts on Intent.",
    checklist: [
      "Open Add → pick intake or uploads (carousel = 2+ stills).",
      "Select the hero clip in the tray; use CapCut / PhotoRoom if you need an edit.",
      "Optional: transparent cutout for Story before you leave Media.",
    ],
  },
  [WORKBENCH_STEP_INTENT]: {
    hint: "Lock drop type, vibe, pillar, persona, hook blueprint, and CTA — channels come on Schedule.",
    checklist: [
      "Set FÜDI drop type or listing vibe (Custom if needed).",
      "Pick content pillar and audience persona from Brain DNA.",
      "Choose hook blueprint + conversion CTA — they feed Copy and formulas.",
    ],
  },
  [WORKBENCH_STEP_CANVAS]: {
    hint: "Drag on-image text on the phone preview — caption and hooks are on Copy.",
    checklist: [
      "Move headline/subhead with the lime drag bar; rotate and resize handles.",
      "Highlight pill: None, translucent black, or brand lime.",
      "Use Center frame / Lower third if needed — polls, links, and music go on your phone at post time.",
    ],
  },
  [WORKBENCH_STEP_COPY]: {
    hint: "Write hook + caption; rotate variants or use formula bank before Schedule.",
    checklist: [
      "Hook is the first line; caption stays IG-ready below.",
      "Use ✨ assist or formula slots for $0 render packs.",
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
