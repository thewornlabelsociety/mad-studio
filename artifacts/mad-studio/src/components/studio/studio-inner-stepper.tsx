"use client"



import { Check } from "lucide-react"



import {

  STUDIO_WIZARD_STEPS,

  type WorkbenchFlowStep,

} from "@/lib/studio/workbench-steps"

import { cn } from "@/lib/utils"



type Props = {

  step: WorkbenchFlowStep

  onStepChange?: (step: WorkbenchFlowStep) => void

  className?: string

}



export function StudioInnerStepper({ step, onStepChange, className }: Props) {

  return (

    <nav

      aria-label="Studio steps"

      className={cn("border-b border-mad-black/15", className)}

    >

      <ol className="flex gap-0">

        {STUDIO_WIZARD_STEPS.map((item, index) => {

          const active = step === item.id

          const complete = step > item.id

          return (

            <li key={item.id} className="flex min-w-0 flex-1">

              <button

                type="button"

                disabled={!onStepChange}

                onClick={() => {

                  onStepChange?.(item.id)

                  window.scrollTo({ top: 0, behavior: "smooth" })

                }}

                className={cn(

                  "flex w-full items-center justify-center gap-1.5 border-b-2 px-1.5 py-2 text-center transition sm:px-2",

                  active

                    ? "border-mad-black text-mad-black"

                    : complete

                      ? "border-mad-lime text-mad-black"

                      : "border-transparent text-neutral-400 hover:text-mad-black"

                )}

              >

                <span

                  className={cn(

                    "flex size-5 shrink-0 items-center justify-center font-typewriter text-[0.65rem] font-bold",

                    active

                      ? "bg-mad-black text-mad-white"

                      : complete

                        ? "bg-mad-lime text-mad-black"

                        : "bg-neutral-100 text-neutral-500"

                  )}

                >

                  {complete ? <Check className="size-3 stroke-[3]" /> : index + 1}

                </span>

                <span className="truncate font-typewriter text-[0.6rem] font-bold tracking-wider uppercase sm:text-[0.65rem]">

                  {item.label}

                </span>

              </button>

            </li>

          )

        })}

      </ol>

    </nav>

  )

}

