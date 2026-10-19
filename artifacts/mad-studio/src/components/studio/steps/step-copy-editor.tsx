"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, Loader2, RotateCcw, Sparkles } from "lucide-react"

import { AutoTextarea } from "@/components/studio/auto-textarea"
type HookChip = { id: string; label: string; hook: string }
import { cn } from "@/lib/utils"

type Props = {
  headline: string
  caption: string
  onHeadlineChange: (value: string) => void
  onCaptionChange: (value: string) => void
  hookChips: HookChip[]
  activeHookId: string | null
  onHookSelect: (hookId: string) => void
  captionVariantLabel?: string | null
  onRotateCaption?: () => void
  onEnhanceCaption?: () => void
  enhancingCaption?: boolean
  onAssistCaption?: () => void
  assistField?: "caption" | null
  captionVariations?: string[]
  onPickCaptionVariation?: (value: string) => void
  /** Hashtag / optimisation tags editor (merged onto caption at publish). */
  tagsSlot?: ReactNode
  /** Studio Copy step — card chrome, viewport-fit layout. */
  wizardCompact?: boolean
  className?: string
}

export function StepCopyEditor({
  headline,
  caption,
  onHeadlineChange,
  onCaptionChange,
  hookChips,
  activeHookId,
  onHookSelect,
  captionVariantLabel = null,
  onRotateCaption,
  onEnhanceCaption,
  enhancingCaption = false,
  onAssistCaption,
  assistField = null,
  captionVariations = [],
  onPickCaptionVariation,
  tagsSlot = null,
  wizardCompact = false,
  className,
}: Props) {
  const [ideasOpen, setIdeasOpen] = useState(wizardCompact)

  const labelClass = wizardCompact
    ? "text-xs font-semibold tracking-wide text-neutral-600 uppercase"
    : "text-[11px] font-medium tracking-[0.16em] text-neutral-500 uppercase"

  const textareaClass = wizardCompact
    ? "min-h-[7rem] w-full flex-1 resize-none border-2 border-mad-black bg-white px-3 py-2.5 text-base leading-relaxed focus:bg-mad-lime/10 focus:outline-none md:min-h-[6rem] md:text-sm"
    : "min-h-[10rem] w-full rounded-sm border border-neutral-300 bg-white px-3 py-3 text-base leading-relaxed focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 md:text-sm"

  const hookTextareaClass = wizardCompact
    ? "w-full resize-none border-2 border-mad-black bg-white px-3 py-2 text-sm leading-snug focus:bg-mad-lime/10 focus:outline-none"
    : "w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm leading-snug focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"

  const aiBtnClass = wizardCompact
    ? "inline-flex shrink-0 items-center gap-1.5 border-2 border-mad-black bg-mad-lime px-3 py-2 text-xs font-bold tracking-wide text-mad-black uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-white disabled:opacity-60"
    : "inline-flex items-center gap-1 rounded-full border border-mad-black bg-mad-lime px-3 py-1.5 text-xs font-semibold text-mad-black hover:bg-mad-black hover:text-white disabled:opacity-60"

  const secondaryBtnClass = wizardCompact
    ? "inline-flex items-center gap-1 border-2 border-mad-black bg-mad-white px-2.5 py-2 text-[11px] font-bold tracking-wide uppercase hover:bg-neutral-100"
    : "inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-neutral-400"

  const captionBlock = (
    <div
      className={cn(
        wizardCompact ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-2"
      )}
    >
      {!wizardCompact ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <label
            htmlFor="studio-copy-caption"
            className={labelClass}
          >
            Post caption
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {captionVariantLabel ? (
              <span className="text-[11px] text-neutral-400">
                {captionVariantLabel}
              </span>
            ) : null}
            {onRotateCaption ? (
              <button
                type="button"
                onClick={onRotateCaption}
                className={secondaryBtnClass}
              >
                <RotateCcw className="size-3" />
                Rotate
              </button>
            ) : null}
            {onEnhanceCaption ? (
              <button
                type="button"
                onClick={() => onEnhanceCaption()}
                disabled={enhancingCaption}
                className="inline-flex items-center gap-1 rounded-full border border-mad-black bg-mad-black px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
              >
                {enhancingCaption ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                AI polish
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <AutoTextarea
        id="studio-copy-caption"
        value={caption}
        onValueChange={onCaptionChange}
        rows={wizardCompact ? 5 : 8}
        placeholder="Write the caption as it should appear on the post — hashtags and link included."
        className={textareaClass}
      />
      {captionVariations.length > 0 ? (
        <ul className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
          {captionVariations.map((variant) => (
            <li key={variant}>
              <button
                type="button"
                onClick={() => onPickCaptionVariation?.(variant)}
                className="w-full border-2 border-mad-black/25 bg-mad-lime/20 px-2 py-1.5 text-left text-xs leading-snug hover:bg-mad-lime"
              >
                {variant}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!wizardCompact && onAssistCaption ? (
        <button
          type="button"
          onClick={onAssistCaption}
          disabled={assistField === "caption"}
          className="text-xs font-medium text-neutral-600 underline-offset-2 hover:text-mad-black hover:underline disabled:opacity-50"
        >
          {assistField === "caption" ? "Suggesting…" : "Suggest caption with AI"}
        </button>
      ) : null}
      {!wizardCompact ? (
        <p className="text-xs leading-relaxed text-neutral-500">
          The phone preview uses this text for Feed and Facebook. Story and TikTok
          use the opening line below on the canvas when set.
        </p>
      ) : null}
    </div>
  )

  const hookBlock = (
    <div
      className={cn(
        wizardCompact ? "flex shrink-0 flex-col gap-2 lg:max-w-[min(100%,22rem)]" : "space-y-2 border-t border-neutral-100 pt-5"
      )}
    >
      <label htmlFor="studio-copy-hook" className={labelClass}>
        Opening line (optional)
      </label>
      <AutoTextarea
        id="studio-copy-hook"
        value={headline}
        onValueChange={onHeadlineChange}
        rows={wizardCompact ? 3 : 2}
        placeholder="Story / Reels hook — blank uses the start of your caption."
        className={hookTextareaClass}
      />
      {wizardCompact ? (
        <p className="text-xs leading-snug text-neutral-500">
          Pick a Brain hook below — not a second AI pass. Story & TikTok use this
          line when set.
        </p>
      ) : null}
    </div>
  )

  const hookIdeas = hookChips.length > 0 ? (
    <div
      className={cn(
        wizardCompact
          ? "shrink-0 border-t border-neutral-200 pt-3"
          : "border-t border-neutral-100 pt-4"
      )}
    >
      <button
        type="button"
        onClick={() => setIdeasOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-neutral-800"
        aria-expanded={ideasOpen}
      >
        Opening lines from Brain (media + intent)
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-neutral-400 transition-transform",
            ideasOpen && "rotate-180"
          )}
        />
      </button>
      {ideasOpen ? (
        <ul
          className={cn(
            "mt-2 space-y-1.5 overflow-y-auto",
            wizardCompact && "max-h-[min(28vh,11rem)]"
          )}
        >
          {hookChips.slice(0, 6).map((hook) => {
            const active = activeHookId === hook.id
            return (
              <li key={hook.id}>
                <button
                  type="button"
                  onClick={() => onHookSelect(hook.id)}
                  className={cn(
                    "w-full border px-3 py-2 text-left text-sm transition",
                    wizardCompact ? "border-mad-black/20" : "rounded-sm",
                    active
                      ? "border-mad-black bg-mad-lime/25"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  )}
                >
                  <span className="text-[10px] font-medium tracking-wide text-mad-vermillion uppercase">
                    {hook.label}
                  </span>
                  <span className="mt-0.5 block leading-snug text-neutral-800">
                    {hook.hook}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  ) : null

  if (wizardCompact) {
    return (
      <section
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-mad-black bg-mad-white shadow-keycap-sm",
          className
        )}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b-2 border-mad-black/10 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Caption</p>
            <p className="text-xs text-neutral-500">
              {captionVariantLabel
                ? `${captionVariantLabel} · `
                : null}
              Suggest with AI uses your photo + Intent + Canvas text
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onRotateCaption ? (
              <button type="button" onClick={onRotateCaption} className={secondaryBtnClass}>
                <RotateCcw className="size-3" />
                Rotate
              </button>
            ) : null}
            {onEnhanceCaption ? (
              <button
                type="button"
                onClick={() => onEnhanceCaption()}
                disabled={enhancingCaption}
                className={secondaryBtnClass}
              >
                {enhancingCaption ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sparkles className="size-3" />
                )}
                Polish
              </button>
            ) : null}
            {onAssistCaption ? (
              <button
                type="button"
                onClick={onAssistCaption}
                disabled={assistField === "caption"}
                className={aiBtnClass}
              >
                {assistField === "caption" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {assistField === "caption" ? "Suggesting…" : "Suggest with AI"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-5">
          <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row md:gap-5">
            {captionBlock}
            {hookBlock}
          </div>
          {tagsSlot ? (
            <div className="shrink-0 border-t border-neutral-200 pt-3">{tagsSlot}</div>
          ) : null}
        </div>

        {hookIdeas ? (
          <div className="shrink-0 px-4 pb-4 md:px-5 md:pb-5">{hookIdeas}</div>
        ) : null}
      </section>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {captionBlock}
      {hookBlock}
      {tagsSlot}
      {hookIdeas}
    </div>
  )
}
