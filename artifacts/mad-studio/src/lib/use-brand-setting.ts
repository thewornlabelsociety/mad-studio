"use client"

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"

import { saveTemplateSetting } from "@/lib/actions"
import { createClient } from "@/lib/supabase/client"
import { useRememberedState } from "@/lib/use-remembered-state"

/** The brand's saved template settings, fetched once per brand per page. */
const loaded = new Map<string, Promise<Record<string, unknown>>>()

function brandSettings(entityId: string): Promise<Record<string, unknown>> {
  let pending = loaded.get(entityId)
  if (!pending) {
    pending = Promise.resolve(
      createClient().from("entities").select("brand_identity").eq("id", entityId).maybeSingle()
    ).then(({ data }) => {
      const identity = data?.brand_identity as { template_settings?: unknown } | null
      const settings = identity?.template_settings
      return settings && typeof settings === "object" && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {}
    })
    pending.catch(() => loaded.delete(entityId))
    loaded.set(entityId, pending)
  }
  return pending
}

/**
 * A template setting kept with the brand, so the phone, the laptop and the
 * team all see the same card style, dot special and colours.
 *
 * Works like useRememberedState: the on-device copy (under `localKey`) shows
 * straight away, then the brand's saved value replaces it. Changes save to the
 * brand shortly after the last edit. The first time, a setting that only
 * exists on this device is copied up to the brand, so nothing resets.
 */
export function useBrandSetting<T>(
  entityId: string,
  key: string,
  localKey: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setLocal] = useRememberedState<T>(localKey, initial)
  const latest = useRef(value)
  latest.current = value
  const timer = useRef<number | null>(null)
  // A change still waiting to save, sent at once if the screen closes first.
  const waiting = useRef<{ value: T } | null>(null)

  const send = useCallback(
    (next: T) => {
      waiting.current = null
      void saveTemplateSetting({ entityId, key, value: next }).then((result: { ok?: boolean } | undefined) => {
          if (result?.ok) {
            // Keep this page's copy of the brand settings current.
            void brandSettings(entityId).then((settings) => {
              settings[key] = next
            })
          }
      })
    },
    [entityId, key]
  )

  const push = useCallback(
    (next: T) => {
      if (timer.current) window.clearTimeout(timer.current)
      waiting.current = { value: next }
      timer.current = window.setTimeout(() => send(next), 700)
    },
    [send]
  )

  useEffect(() => {
    let cancelled = false
    void brandSettings(entityId)
      .then((settings) => {
        if (cancelled) return
        if (key in settings && settings[key] != null) {
          setLocal(settings[key] as T)
        } else if (JSON.stringify(latest.current) !== JSON.stringify(initial)) {
          // Only on this device so far: share it with the brand.
          push(latest.current)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, key])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
      if (waiting.current) send(waiting.current.value)
    },
    [send]
  )

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (action) => {
      const next = typeof action === "function" ? (action as (current: T) => T)(latest.current) : action
      latest.current = next
      setLocal(next)
      push(next)
    },
    [push, setLocal]
  )

  return [value, setValue]
}
