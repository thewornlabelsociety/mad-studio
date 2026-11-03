import { forwardRef } from "react"

import { NO_ADJUST, type LayerAdjust } from "@/components/templates/adjustable-layer"
import { EditItemSlide } from "@/components/templates/edit-slides"
import type { StoryBackground } from "@/lib/brands/story-kit"
import { DEFAULT_STORY_CARD_STYLE, type StoryCardStyle } from "@/lib/templates/story-card-style"

type Props = {
  background: StoryBackground
  brandName: string
  /** Top-left label, e.g. NEW IN. Null leaves it off. */
  tag: string | null
  imageUrl: string | null
  /** Null or empty leaves the line off. */
  vibe: string | null
  designer: string | null
  sizeLabel: string | null
  /** e.g. SILK: a pill under the header. */
  fabricLabel?: string | null
  /** The kind of piece, e.g. LEATHER JACKET. */
  categoryLabel?: string | null
  /** Small line above the brand, e.g. NO. 01. */
  eyebrow?: string | null
  /** e.g. $120. */
  priceLabel?: string | null
  /** What shows and how it lines up; the same for every Story card. */
  cardStyle?: StoryCardStyle
  /** Hand placement of the cutout. */
  subject?: LayerAdjust
  /** Given, the cutout can be dragged, resized and tilted. */
  onSubjectChange?: (next: LayerAdjust) => void
  subjectSelected?: boolean
  onSubjectSelect?: (selected: boolean) => void
  /** Sale Stories: the old price struck through, then the new one. */
  priceLine?: { was: string; now: string } | null
  /** Dashed link-sticker zone; never baked into the export. */
  showLinkGuide?: boolean
  className?: string
}

/**
 * A new-arrival Story: the Themed edit's piece card in Story size, so Stories
 * and edits look like one set. Card style picks which words show and how they
 * line up; the background (with its text and accent colours) varies per Story.
 */
export const KitStoryCanvas = forwardRef<HTMLDivElement, Props>(function KitStoryCanvas(
  {
    background,
    brandName,
    tag,
    imageUrl,
    vibe,
    designer,
    sizeLabel,
    fabricLabel = null,
    categoryLabel = null,
    eyebrow = null,
    priceLabel = null,
    cardStyle = DEFAULT_STORY_CARD_STYLE,
    subject = NO_ADJUST,
    onSubjectChange,
    subjectSelected = false,
    onSubjectSelect,
    priceLine = null,
    showLinkGuide = true,
    className,
  },
  ref
) {
  const show = cardStyle.fields
  return (
    <EditItemSlide
      ref={ref}
      className={className}
      story
      background={background}
      brandName={brandName}
      editLabel={tag ?? ""}
      eyebrow={show.number ? eyebrow : null}
      align={cardStyle.align}
      imageUrl={imageUrl}
      designer={show.brand ? designer : null}
      categoryLabel={show.category ? categoryLabel : null}
      vibeLabel={show.vibe ? vibe : null}
      sizeLabel={show.size ? sizeLabel : null}
      fabricLabel={fabricLabel}
      pillAlign={cardStyle.pillAlign}
      pillFill={cardStyle.pillFill}
      pillShape={cardStyle.pillShape}
      // A sale always shows its prices; otherwise the Price switch decides.
      priceLabel={priceLine ? priceLine.now : show.price ? priceLabel : null}
      wasLabel={priceLine ? priceLine.was : null}
      subject={subject}
      onSubjectChange={onSubjectChange}
      subjectSelected={subjectSelected}
      onSubjectSelect={onSubjectSelect}
      showLinkGuide={showLinkGuide}
    />
  )
})
