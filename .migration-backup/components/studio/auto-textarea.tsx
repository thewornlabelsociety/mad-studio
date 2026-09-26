"use client"

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type FocusEvent,
  type TextareaHTMLAttributes,
} from "react"

import { cn } from "@/lib/utils"

type AutoTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
> & {
  value: string
  onValueChange: (value: string) => void
  onCommit?: () => void
}

export function AutoTextarea({
  value,
  onValueChange,
  onCommit,
  className,
  onBlur,
  rows = 2,
  ...props
}: AutoTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, 40)}px`
  }, [value])

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onValueChange(event.target.value)
  }

  function handleBlur(event: FocusEvent<HTMLTextAreaElement>) {
    onCommit?.()
    onBlur?.(event)
  }

  return (
    <textarea
      {...props}
      ref={ref}
      rows={rows}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(
        "w-full resize-none overflow-hidden border border-transparent bg-transparent px-2 py-1.5 text-sm leading-relaxed text-mad-black outline-none transition-[border-color,box-shadow] placeholder:text-neutral-400 focus:rounded-lg focus:border-black focus:ring-1 focus:ring-black",
        className
      )}
    />
  )
}
