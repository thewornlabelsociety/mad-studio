"use client"

import { useEffect } from "react"

import { resolveTemplateFonts, templateFontVars, type TemplateFonts } from "@/lib/brands/template-fonts"
import { createClient } from "@/lib/supabase/client"

/** Sent by the brand kit after saving, so open templates restyle without a reload. */
export const TEMPLATE_FONTS_EVENT = "mad:template-fonts"

export type TemplateFontsEventDetail = { entityId: string; fonts: TemplateFonts }

/** Puts a font set on the page as the --kit-* variables every template reads. */
export function applyTemplateFonts(fonts: TemplateFonts, element: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(templateFontVars(fonts))) {
    element.style.setProperty(name, value)
  }
}

/**
 * Loads the active brand's template fonts from its brand kit and applies them
 * to the whole page. Mounted once in the app shell.
 */
export function useBrandTemplateFonts(entityId: string | null | undefined) {
  useEffect(() => {
    if (!entityId) return
    let cancelled = false
    void createClient()
      .from("entities")
      .select("brand_identity")
      .eq("id", entityId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const identity = data?.brand_identity as { visual_presets?: { template_fonts?: unknown } } | null
        applyTemplateFonts(resolveTemplateFonts(identity?.visual_presets?.template_fonts))
      })

    function onSaved(event: Event) {
      const detail = (event as CustomEvent<TemplateFontsEventDetail>).detail
      if (detail?.entityId === entityId) applyTemplateFonts(detail.fonts)
    }
    window.addEventListener(TEMPLATE_FONTS_EVENT, onSaved)
    return () => {
      cancelled = true
      window.removeEventListener(TEMPLATE_FONTS_EVENT, onSaved)
    }
  }, [entityId])
}
