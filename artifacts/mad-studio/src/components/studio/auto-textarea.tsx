"use client"

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type TextareaHTMLAttributes,
} from "react"

import { cn } from "@/lib/utils"

type AutoTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value"
> & {
  value: string
  onValueChange: (value: string) => void
  onCommit?: () => void
}

function resizeToContent(el: HTMLTextAreaElement, minHeight = 40) {
  el.style.height = "auto"
  el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`
}

function restoreSelection(
  el: HTMLTextAreaElement,
  start: number | null,
  end: number | null
) {
  if (start == null || end == null) return
  if (document.activeElement !== el) return
  try {
    el.setSelectionRange(start, end)
  } catch {
    // Some browsers reject out-of-range indices during the same tick.
  }
}

export function AutoTextarea({
  value,
  onValueChange,
  onCommit,
  className,
  onBlur,
  onFocus,
  rows = 2,
  ...props
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const focusedRef = useRef(false)
  const lastEmittedRef = useRef(value)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value)
      lastEmittedRef.current = value
      const el = ref.current
      if (el) resizeToContent(el)
      return
    }
    if (value !== lastEmittedRef.current) {
      setDraft(value)
      lastEmittedRef.current = value
    }
  }, [value])

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const el = event.target
    const next = el.value
    const selStart = el.selectionStart
    const selEnd = el.selectionEnd
    setDraft(next)
    lastEmittedRef.current = next
    onValueChange(next)
    requestAnimationFrame(() => {
      if (!ref.current) return
      resizeToContent(ref.current)
      restoreSelection(ref.current, selStart, selEnd)
    })
  }

  function handleFocus(event: FocusEvent<HTMLTextAreaElement>) {
    focusedRef.current = true
    onFocus?.(event)
  }

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
    focusedRef.current = false
    lastEmittedRef.current = draft
    onValueChange(draft)
    onCommit?.()
    onBlur?.(event)
    requestAnimationFrame(() => {
      if (ref.current) resizeToContent(ref.current)
    })
  }

  return (
    <textarea
      {...props}
      ref={ref}
      dir="ltr"
      rows={rows}
      value={draft}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cn(
        "w-full resize-none overflow-hidden border border-transparent bg-transparent px-2 py-1.5 font-sans text-sm leading-relaxed tracking-normal text-mad-black outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:rounded-lg focus:border-black focus:ring-1 focus:ring-black",
        className
      )}
    />
  )
}
