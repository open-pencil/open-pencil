// eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { generate, parse, walk, type CssNode as CSSNode } from 'css-tree'

import { parseCSSFontFamily } from '@open-pencil/scene-graph/css'

/** A stylesheet's `@font-face` rule: the face it declares and the files it loads from. */
export interface CSSFontFaceRule {
  family: string
  /** The rule's weight; for a variable font's range, 400 when the range holds it. */
  weight: number
  italic: boolean
  /** The `src` URLs in the rule's order, resolved against the stylesheet's URL when it has one. */
  sources: string[]
}

const WEIGHT_KEYWORDS: Partial<Record<string, number>> = { normal: 400, bold: 700 }

function weightValue(word: string): number | null {
  const keyword = WEIGHT_KEYWORDS[word.toLowerCase()]
  if (keyword !== undefined) return keyword
  const number = Number(word)
  return Number.isFinite(number) ? number : null
}

/**
 * The weight a rule's face is registered at: its own, or for a variable font's range the regular
 * weight when the range holds it, else the nearer end; 400 when it names none.
 */
function weightOf(value: string | undefined): number {
  const weights = (value?.trim().split(/\s+/) ?? []).map(weightValue)
  const low = weights.at(0) ?? null
  const high = weights.at(1) ?? null
  if (low === null) return 400
  if (high === null) return low
  return Math.min(Math.max(400, low), high)
}

function resolved(url: string, base: string | undefined): string | null {
  try {
    return new URL(url, base).href
  } catch {
    return null
  }
}

function sourcesOf(value: CSSNode, base: string | undefined): string[] {
  const sources: string[] = []
  walk(value, (node) => {
    if (node.type !== 'Url') return
    const url = resolved(node.value, base)
    if (url) sources.push(url)
  })
  return sources
}

/**
 * The `@font-face` rules of a stylesheet, wherever they sit in it, with their URLs resolved
 * against `baseURL`. A rule without a family or a source is left out.
 */
export function parseFontFaceRules(cssText: string, baseURL?: string): CSSFontFaceRule[] {
  const rules: CSSFontFaceRule[] = []
  const sheet = parse(cssText, { positions: false, onParseError: () => undefined })
  walk(sheet, (node) => {
    if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'font-face' || !node.block) return
    const values = new Map<string, CSSNode>()
    walk(node.block, (child) => {
      if (child.type === 'Declaration') values.set(child.property.toLowerCase(), child.value)
    })
    const familyValue = values.get('font-family')
    const src = values.get('src')
    const family = familyValue ? parseCSSFontFamily(generate(familyValue)) : null
    const sources = src ? sourcesOf(src, baseURL) : []
    if (!family || sources.length === 0) return
    const weight = values.get('font-weight')
    const style = values.get('font-style')
    rules.push({
      family,
      weight: weightOf(weight && generate(weight)),
      italic: style !== undefined && /italic|oblique/i.test(generate(style)),
      sources
    })
  })
  return rules
}

/** The URLs a stylesheet's `@import` rules load, resolved against `baseURL`, in order. */
export function parseStylesheetImports(cssText: string, baseURL?: string): string[] {
  const urls: string[] = []
  const sheet = parse(cssText, { positions: false, onParseError: () => undefined })
  walk(sheet, (node) => {
    if (node.type !== 'Atrule' || node.name.toLowerCase() !== 'import' || !node.prelude) return
    // The rule's first URL or string names the sheet; media and layer names may follow.
    let target: string | undefined
    walk(node.prelude, (part) => {
      if (target === undefined && (part.type === 'Url' || part.type === 'String')) {
        target = part.value
      }
    })
    const url = target === undefined ? null : resolved(target, baseURL)
    if (url) urls.push(url)
  })
  return urls
}
