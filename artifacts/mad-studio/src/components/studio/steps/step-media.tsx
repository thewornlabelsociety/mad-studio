"use client"

import { ChevronDown, FolderOpen } from "lucide-react"

import {
  MediaTray,
  type MediaAsset,
} from "@/components/marketing/media-tray"
import { BrainTeamIdeas } from "@/components/studio/brain-team-ideas"
import { FinishedRenderDropZone } from "@/components/studio/finished-render-drop"
import type { MediaVisualInspection } from "@/lib/media/inspect-schema"
import type { MediaKind } from "@/lib/media/kind"
import { StudioStepPanel } from "@/components/studio/studio-step-panel"
import { ToolIconButton } from "@/components/studio/tool-icon-button"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  entityId: string
  brandName?: string
  industry?: string | null
  marketingEntityId?: string | null
  assets: MediaAsset[]
  activeId: string | null
  onAssetsChange: (assets: MediaAsset[]) => void
  onSelectMedia: (asset: MediaAsset) => void
  onIntakeAssetsAdded?: (assets: MediaAsset[]) => void
  onVisualInspect?: (
    assetId: string,
    inspection: MediaVisualInspection | null
  ) => void
  onFinishedRender: (publicUrl: string, kind: MediaKind) => void
  onOpenMediaLibrary: () => void
  disabled?: boolean
  visualDescription?: string | null
  /** Suggested new arrivals, shown under the tools. */
  suggestionsSlot?: React.ReactNode
  /** Brand template picker (Media step). */
  templatePickerSlot?: React.ReactNode
  /**
   * Ready-made posts, shown first. Given, everything else folds under
   * "Create manually".
   */
  templatesSlot?: React.ReactNode
  manualOpen?: boolean
  onManualOpenChange?: (open: boolean) => void
  className?: string
}

export function StepMedia({
  entityId,
  brandName,
  industry = null,
  marketingEntityId = null,
  assets,
  activeId,
  onAssetsChange,
  onSelectMedia,
  onIntakeAssetsAdded,
  onVisualInspect,
  onFinishedRender,
  onOpenMediaLibrary,
  disabled = false,
  visualDescription = null,
  suggestionsSlot = null,
  templatePickerSlot = null,
  templatesSlot = null,
  manualOpen = true,
  onManualOpenChange,
  className,
}: Props) {
  const folds = Boolean(templatesSlot)
  const showManual = !folds || manualOpen
  return (
    <StudioStepPanel
      compactHeader
      className={className}
      kicker="1 · Pick"
      title={folds ? "Start from a template" : "Photos and video"}
      description={
        folds
          ? "Pick one of this week's posts, or create one by hand below."
          : "Upload, open the library, or tap shop items below to add them."
      }
      scrollBody={false}
    >
      {templatesSlot}
      {folds ? (
        <button
          type="button"
          onClick={() => onManualOpenChange?.(!manualOpen)}
          aria-expanded={manualOpen}
          aria-controls="studio-create-manually"
          className="mt-4 flex w-full items-center justify-between border-2 border-mad-black bg-white px-3 py-2.5 hover:bg-[#F4EFE6]"
        >
          <span className="text-left">
            <span className="block font-typewriter text-xs font-bold uppercase tracking-widest">Create manually</span>
            <span className="block text-xs text-mad-black/65">Upload photos or pick shop products yourself</span>
          </span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", manualOpen && "rotate-180")} aria-hidden />
        </button>
      ) : null}
      {showManual ? (
        <div id="studio-create-manually" className={folds ? "mt-3 space-y-3" : "contents"}>
          {templatePickerSlot}
          <MediaTray
            entityId={entityId}
            brandName={brandName}
            industry={industry}
            inventoryItemId={marketingEntityId}
            assets={assets}
            activeId={activeId}
            onAssetsChange={onAssetsChange}
            onSelectMedia={onSelectMedia}
            onIntakeAssetsAdded={onIntakeAssetsAdded}
            onVisualInspect={onVisualInspect}
            disabled={disabled}
          />

          <TooltipProvider>
            <div
              className="mt-3 flex shrink-0 flex-wrap items-center gap-2"
              role="toolbar"
              aria-label="Media tools"
            >
              <ToolIconButton
                label="Media library"
                hint="Pick photos and reels — choose 2 or more for a carousel."
                onClick={onOpenMediaLibrary}
                disabled={disabled}
                icon={<FolderOpen className="size-5" />}
              />
              {brandName ? (
                <BrainTeamIdeas
                  entityId={entityId}
                  brandName={brandName}
                  industry={industry}
                  disabled={disabled}
                />
              ) : null}
              <span aria-hidden className="mx-1 h-7 w-px bg-neutral-300" />
              <FinishedRenderDropZone
                iconOnly
                entityId={entityId}
                marketingEntityId={marketingEntityId}
                onReady={onFinishedRender}
              />
            </div>
          </TooltipProvider>

          {visualDescription ? (
            <p className="mt-4 border-l-2 border-mad-lime pl-2 text-xs leading-relaxed text-neutral-600">
              {visualDescription}
            </p>
          ) : null}

          {suggestionsSlot}
        </div>
      ) : null}
    </StudioStepPanel>
  )
}
