"use client"

import { cn } from "@/lib/utils"

type Slide = {
  id: string
  url: string
  hasText: boolean
}

type Props = {
  slides: Slide[]
  activeId: string | null
  onSelect: (id: string) => void
}

/** Pick which carousel photo the Canvas text applies to — each has its own. */
export function CanvasSlidePicker({ slides, activeId, onSelect }: Props) {
  const activeIndex = slides.findIndex((slide) => slide.id === activeId)
  return (
    <div className="mb-4 border-b-2 border-mad-black/10 pb-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-typewriter text-[0.72rem] font-bold tracking-widest text-mad-black uppercase">
          Editing slide {activeIndex >= 0 ? activeIndex + 1 : 1} of {slides.length}
        </p>
        <p className="text-xs text-neutral-500">
          Each photo has its own text — pick one to edit.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Carousel slides">
        {slides.map((slide, index) => {
          const active = slide.id === activeId
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(slide.id)}
              className={cn(
                "relative size-14 shrink-0 overflow-hidden border-2 transition",
                active
                  ? "border-mad-black ring-2 ring-mad-vermillion ring-offset-1"
                  : "border-neutral-300 hover:border-mad-black"
              )}
              title={`Slide ${index + 1}${slide.hasText ? " · has text" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.url} alt="" className="size-full object-cover" />
              <span className="absolute bottom-0 left-0 bg-mad-black px-1 font-typewriter text-[0.7rem] font-bold text-mad-white">
                {index + 1}
              </span>
              {slide.hasText ? (
                <span
                  className="absolute top-0.5 right-0.5 bg-mad-lime px-1 font-typewriter text-[0.68rem] font-bold text-mad-black"
                  aria-hidden
                >
                  T
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
