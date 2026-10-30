"use client"

/**
 * Font CSS for exporting a node with html-to-image, holding only the fonts the
 * node uses. Left to itself html-to-image embeds every web font on the page
 * (about 13 MB here), which makes each Story take 6-9 seconds to save.
 */

/** Font files already turned into data URLs, by URL. */
const fileCache = new Map<string, Promise<string>>()
/** Finished CSS by font set, so a run of Stories builds it once. */
const cssCache = new Map<string, Promise<string>>()
/** Every @font-face rule on the page, with the stylesheet URL it came from. */
let faces: Promise<Array<{ css: string; base: string }>> | null = null

function cleanFamily(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").toLowerCase()
}

/** The font families used inside `node`. */
export function fontFamiliesIn(node: HTMLElement): Set<string> {
  const families = new Set<string>()
  for (const element of [node, ...Array.from(node.querySelectorAll<HTMLElement>("*"))]) {
    for (const family of getComputedStyle(element).fontFamily.split(",")) families.add(cleanFamily(family))
  }
  return families
}

async function pageFontFaces(): Promise<Array<{ css: string; base: string }>> {
  const found: Array<{ css: string; base: string }> = []
  for (const sheet of Array.from(document.styleSheets)) {
    const base = sheet.href ?? window.location.href
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSFontFaceRule) found.push({ css: rule.cssText, base })
      }
    } catch {
      // Another site's stylesheet (Google Fonts): read its text instead.
      if (!sheet.href) continue
      try {
        const text = await (await fetch(sheet.href)).text()
        for (const css of text.match(/@font-face\s*{[^}]*}/g) ?? []) found.push({ css, base: sheet.href })
      } catch {
        /* that font falls back to a system one */
      }
    }
  }
  return found
}

function asDataUrl(url: string): Promise<string> {
  let file = fileCache.get(url)
  if (!file) {
    file = fetch(url)
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          })
      )
    file.catch(() => fileCache.delete(url))
    fileCache.set(url, file)
  }
  return file
}

/** Latin and Latin Extended (for macrons) only; Cyrillic, Greek and so on are left out. */
function wantedRange(css: string): boolean {
  const range = /unicode-range:\s*([^;}]*)/i.exec(css)?.[1]
  return !range || /U\+0{0,4}0-|U\+0100-/i.test(range)
}

async function buildCss(families: Set<string>): Promise<string> {
  faces ??= pageFontFaces()
  const rules = (await faces).filter(({ css }) => {
    const family = /font-family:\s*([^;}]*)/i.exec(css)?.[1]
    return family != null && families.has(cleanFamily(family)) && wantedRange(css)
  })
  const inlined = await Promise.all(
    rules.map(async ({ css, base }) => {
      let out = css
      for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        if (match[1].startsWith("data:")) continue
        try {
          out = out.replace(match[0], `url(${await asDataUrl(new URL(match[1], base).href)})`)
        } catch {
          /* leave the link; that weight falls back */
        }
      }
      return out
    })
  )
  return inlined.join("\n")
}

/** Embed-ready CSS for just the fonts `node` uses (built once per font set). */
export function storyFontCss(node: HTMLElement): Promise<string> {
  const families = fontFamiliesIn(node)
  const key = [...families].sort().join("|")
  let css = cssCache.get(key)
  if (!css) {
    css = buildCss(families)
    css.catch(() => cssCache.delete(key))
    cssCache.set(key, css)
  }
  return css
}
