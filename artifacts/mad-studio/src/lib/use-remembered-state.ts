"use client"

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"

function read<T>(key: string | null): T | undefined {
  if (!key) return undefined
  try {
    const raw = window.localStorage.getItem(key)
    return raw == null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

/**
 * useState that survives leaving the screen: the value is kept in this
 * browser under `key` and read back next time. A null key just doesn't
 * remember. Drafts stay on this device only.
 */
export function useRememberedState<T>(
  key: string | null,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const saved = read<T>(key)
    if (saved !== undefined) return saved
    return typeof initial === "function" ? (initial as () => T)() : initial
  })

  // A new key (another brand or week) loads what was kept under it.
  const lastKey = useRef(key)
  useEffect(() => {
    if (lastKey.current === key) return
    lastKey.current = key
    const saved = read<T>(key)
    setValue(saved !== undefined ? saved : typeof initial === "function" ? (initial as () => T)() : initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (!key) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* full or blocked storage: the draft lasts until the page closes */
    }
  }, [key, value])

  return [value, setValue]
}
