"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { CampaignPack } from "@/lib/campaigns/pack-schema"

const HISTORY_LIMIT = 40
const HISTORY_DEBOUNCE_MS = 300

function clonePack(pack: CampaignPack): CampaignPack {
  return structuredClone(pack)
}

function packsEqual(a: CampaignPack, b: CampaignPack): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function usePackHistory(pack: CampaignPack | null) {
  const [undoStack, setUndoStack] = useState<CampaignPack[]>([])
  const [redoStack, setRedoStack] = useState<CampaignPack[]>([])
  const [burstActive, setBurstActive] = useState(false)
  const baselineRef = useRef<CampaignPack | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const packRef = useRef(pack)
  packRef.current = pack

  const clearHistory = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    baselineRef.current = null
    setBurstActive(false)
    setUndoStack([])
    setRedoStack([])
  }, [])

  const commitBaseline = useCallback(() => {
    const baseline = baselineRef.current
    const current = packRef.current
    if (!baseline || !current) {
      baselineRef.current = null
      setBurstActive(false)
      return
    }
    if (!packsEqual(baseline, current)) {
      setUndoStack((stack) => [...stack, baseline].slice(-HISTORY_LIMIT))
      setRedoStack([])
    }
    baselineRef.current = null
    setBurstActive(false)
  }, [])

  const scheduleHistoryCommit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      commitBaseline()
    }, HISTORY_DEBOUNCE_MS)
  }, [commitBaseline])

  const beginEditBurst = useCallback(() => {
    if (!packRef.current) return
    if (!baselineRef.current) {
      baselineRef.current = clonePack(packRef.current)
      setBurstActive(true)
    }
    scheduleHistoryCommit()
  }, [scheduleHistoryCommit])

  const flushHistory = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    commitBaseline()
  }, [commitBaseline])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const undo = useCallback((): CampaignPack | null => {
    const current = packRef.current
    if (!current) return null

    if (baselineRef.current) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      const restored = clonePack(baselineRef.current)
      baselineRef.current = null
      setBurstActive(false)
      return restored
    }

    if (undoStack.length === 0) return null
    const previous = undoStack[undoStack.length - 1]
    setUndoStack((stack) => stack.slice(0, -1))
    setRedoStack((stack) =>
      [...stack, clonePack(current)].slice(-HISTORY_LIMIT)
    )
    return clonePack(previous)
  }, [undoStack])

  const redo = useCallback((): CampaignPack | null => {
    flushHistory()
    const current = packRef.current
    if (!current || redoStack.length === 0) return null
    const next = redoStack[redoStack.length - 1]
    setRedoStack((stack) => stack.slice(0, -1))
    setUndoStack((stack) =>
      [...stack, clonePack(current)].slice(-HISTORY_LIMIT)
    )
    return clonePack(next)
  }, [flushHistory, redoStack])

  return {
    canUndo: undoStack.length > 0 || burstActive,
    canRedo: redoStack.length > 0,
    beginEditBurst,
    flushHistory,
    clearHistory,
    undo,
    redo,
  }
}
