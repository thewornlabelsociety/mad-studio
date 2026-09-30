"use client"

import { useEffect, useMemo, type ReactNode } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { StudioEntityDna } from "@/lib/campaigns/entity-dna"
import {
  defaultSlotsFromSpark,
  resolveConversionActions,
  resolveFormulaBank,
  type FormulaRenderSlots,
} from "@/lib/studio/formula-bank"
import { cn } from "@/lib/utils"

type Props = {
  entity: StudioEntityDna
  spark: string
  hookId: string | null
  visualId: string | null
  ctaId: string | null
  onHookIdChange: (id: string) => void
  onVisualIdChange: (id: string) => void
  onCtaIdChange: (id: string) => void
  slots: FormulaRenderSlots
  onSlotsChange: (slots: FormulaRenderSlots) => void
}

export function FormulaBankPanel({
  entity,
  spark,
  hookId,
  visualId,
  ctaId,
  onHookIdChange,
  onVisualIdChange,
  onCtaIdChange,
  slots,
  onSlotsChange,
}: Props) {
  const bank = useMemo(
    () => resolveFormulaBank(entity.brand_identity),
    [entity.brand_identity]
  )
  const ctas = useMemo(
    () => resolveConversionActions(entity.conversion_goals),
    [entity.conversion_goals]
  )

  const selectedHook = bank.hook_styles.find((h) => h.id === hookId)
  const selectedVisual = bank.visual_directions.find((v) => v.id === visualId)
  const selectedCta = ctas.find((c) => c.id === ctaId)

  useEffect(() => {
    if (!hookId && bank.hook_styles[0]) {
      onHookIdChange(bank.hook_styles[0].id)
    }
    if (!visualId && bank.visual_directions[0]) {
      onVisualIdChange(bank.visual_directions[0].id)
    }
    if (!ctaId && ctas[0]) {
      onCtaIdChange(ctas[0].id)
    }
  }, [
    bank.hook_styles,
    bank.visual_directions,
    ctas,
    hookId,
    visualId,
    ctaId,
    onHookIdChange,
    onVisualIdChange,
    onCtaIdChange,
  ])

  function patchSlot(key: keyof FormulaRenderSlots, value: string) {
    onSlotsChange({ ...slots, [key]: value })
  }

  return (
    <section className="mt-4 space-y-4 border-t-2 border-mad-black pt-4">
      <div>
        <p className="font-typewriter text-[0.6rem] font-bold tracking-widest text-mad-vermillion uppercase">
          Formula bank · $0 render
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          Pre-calibrated hooks, visual beats, and CTAs — no AI tokens until you
          choose full Generate.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Hook style">
          <Select value={hookId ?? ""} onValueChange={onHookIdChange}>
            <SelectTrigger className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase">
              <SelectValue placeholder="Hook" />
            </SelectTrigger>
            <SelectContent>
              {bank.hook_styles.map((hook) => (
                <SelectItem key={hook.id} value={hook.id}>
                  {hook.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Visual direction">
          <Select value={visualId ?? ""} onValueChange={onVisualIdChange}>
            <SelectTrigger className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase">
              <SelectValue placeholder="Visual" />
            </SelectTrigger>
            <SelectContent>
              {bank.visual_directions.map((visual) => (
                <SelectItem key={visual.id} value={visual.id}>
                  {visual.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Conversion CTA">
          <Select value={ctaId ?? ""} onValueChange={onCtaIdChange}>
            <SelectTrigger className="rounded-none border-2 border-mad-black font-typewriter text-[0.65rem] uppercase">
              <SelectValue placeholder="CTA" />
            </SelectTrigger>
            <SelectContent>
              {ctas.map((cta) => (
                <SelectItem key={cta.id} value={cta.id}>
                  {cta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SlotInput
          label="Item"
          value={slots.item}
          onChange={(v) => patchSlot("item", v)}
        />
        <SlotInput
          label="City / area"
          value={slots.cityArea}
          onChange={(v) => patchSlot("cityArea", v)}
        />
        <SlotInput
          label="Price A"
          value={slots.priceA}
          onChange={(v) => patchSlot("priceA", v)}
        />
        <SlotInput
          label="Price B"
          value={slots.priceB}
          onChange={(v) => patchSlot("priceB", v)}
        />
        <SlotInput
          label="Location"
          value={slots.location}
          onChange={(v) => patchSlot("location", v)}
        />
        <SlotInput
          label="Interest"
          value={slots.interest}
          onChange={(v) => patchSlot("interest", v)}
        />
      </div>

      {(selectedHook || selectedVisual || selectedCta) && (
        <div className="space-y-2 border-2 border-mad-black bg-mad-lime/30 p-3 font-mono text-xs leading-relaxed text-mad-black">
          {selectedHook ? (
            <p>
              <span className="font-typewriter text-[0.55rem] font-bold uppercase">
                Hook preview ·{" "}
              </span>
              {selectedHook.template}
            </p>
          ) : null}
          {selectedVisual ? (
            <p>
              <span className="font-typewriter text-[0.55rem] font-bold uppercase">
                Visual ·{" "}
              </span>
              {selectedVisual.cue}
            </p>
          ) : null}
          {selectedCta ? (
            <p>
              <span className="font-typewriter text-[0.55rem] font-bold uppercase">
                CTA ·{" "}
              </span>
              {selectedCta.action_text}
            </p>
          ) : null}
        </div>
      )}

      <button
        type="button"
        className={cn(
          "w-full border-2 border-mad-black bg-mad-lime px-4 py-2 font-typewriter text-[0.65rem] font-bold tracking-widest uppercase shadow-keycap-sm hover:bg-mad-black hover:text-mad-white sm:w-auto"
        )}
        onClick={() => onSlotsChange(defaultSlotsFromSpark(spark))}
      >
        Fill slots from spark
      </button>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-600 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

function SlotInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="font-typewriter text-[0.55rem] font-bold tracking-widest text-neutral-500 uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border-2 border-mad-black px-2 py-1.5 font-mono text-xs"
      />
    </label>
  )
}
