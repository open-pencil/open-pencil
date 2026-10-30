import { isEmptyObject } from 'es-toolkit/predicate'

import type { GUID } from '@open-pencil/kiwi/fig'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { guidToString, isUnsetGuid } from '@open-pencil/kiwi/fig/guid'
import type {
  CharacterStyleOverride,
  HyperlinkTarget,
  StyleRun,
  TextCase
} from '@open-pencil/scene-graph'
import { styleToWeight } from '@open-pencil/scene-graph/font-style'

import { convertFontFeatures } from '../font/features'
import { convertFontVariations } from '../font/variations'
import { convertFills } from '../paint'
import { convertLetterSpacing, convertLineHeight, mapTextDecoration } from '../text/values'
import { textRunVariableBindings } from '../variable/bindings'
import { styleRefId } from './refs'

const TEXT_CASES = new Set<unknown>(['ORIGINAL', 'UPPER', 'LOWER', 'TITLE'] satisfies TextCase[])

/** A link Figma keeps on characters: to a URL, or to a node by its GUID. */
export function importHyperlink(value: unknown): HyperlinkTarget | undefined {
  if (!value || typeof value !== 'object') return undefined
  const link = value as { url?: unknown; guid?: GUID }
  if (typeof link.url === 'string' && link.url !== '') return { type: 'URL', value: link.url }
  if (link.guid && !isUnsetGuid(link.guid)) return { type: 'NODE', value: guidToString(link.guid) }
  return undefined
}

/**
 * What a range refers to beyond its look: its case, link, styles, and bindings. A style the
 * text uses itself is the range's own only when the range names another.
 */
function applyRangeReferences(
  style: CharacterStyleOverride,
  override: NodeChange,
  text: Pick<NodeChange, 'styleIdForText' | 'styleIdForFill'>
): void {
  if (TEXT_CASES.has(override.textCase)) style.textCase = override.textCase as TextCase
  const hyperlink = importHyperlink(override.hyperlink)
  if (hyperlink) style.hyperlink = hyperlink
  for (const [key, field] of [
    ['textStyleId', 'styleIdForText'],
    ['fillStyleId', 'styleIdForFill']
  ] as const) {
    if (override[field] === undefined) continue
    const id = styleRefId(override[field])
    if (id !== styleRefId(text[field])) style[key] = id
  }
  const boundVariables = textRunVariableBindings(override)
  if (!isEmptyObject(boundVariables)) style.boundVariables = boundVariables
}

function applyTextDecorationOverride(style: CharacterStyleOverride, override: NodeChange): void {
  const deco = override.textDecoration
  if (deco) style.textDecoration = mapTextDecoration(deco)
  if (override.textDecorationStyle)
    style.textDecorationStyle =
      override.textDecorationStyle as CharacterStyleOverride['textDecorationStyle']
  if (override.textDecorationThickness)
    style.textDecorationThickness = override.textDecorationThickness.value ?? null
  if (override.textDecorationSkipInk !== undefined)
    style.textDecorationSkipInk = override.textDecorationSkipInk
  if (override.textUnderlineOffset)
    style.textUnderlineOffset = override.textUnderlineOffset.value ?? null
  if (override.textDecorationFillPaints) {
    const decorationFills = convertFills(override.textDecorationFillPaints)
    if (decorationFills.length > 0) style.textDecorationFills = decorationFills
  }
}

function convertStyleOverride(override: NodeChange, text: NodeChange): CharacterStyleOverride {
  const style: CharacterStyleOverride = {}
  if (override.fontName) {
    style.fontFamily = override.fontName.family
    style.fontWeight = styleToWeight(override.fontName.style)
    style.italic = override.fontName.style.toLowerCase().includes('italic')
    style.fontStyle = override.fontName.style || null
  }
  if (override.fontSize !== undefined) style.fontSize = override.fontSize
  const fontVariations = convertFontVariations(override)
  if (fontVariations.length > 0) style.fontVariations = fontVariations
  // Figma detaches a range's optical size from its font size in the range's own override.
  if (override.detachOpticalSizeFromFontSize !== undefined)
    style.opticalSizeFromFontSize = !override.detachOpticalSizeFromFontSize
  const fontFeatures = convertFontFeatures(override)
  if (fontFeatures.length > 0) style.fontFeatures = fontFeatures
  if (override.letterSpacing) style.letterSpacing = convertLetterSpacing(override.letterSpacing)
  if (override.lineHeight) {
    // A run in auto lines up at its own font's height, even in text with a fixed one.
    style.lineHeight = convertLineHeight(override.lineHeight)
  }
  applyTextDecorationOverride(style, override)
  if (override.fillPaints) {
    const fills = convertFills(override.fillPaints)
    if (fills.length > 0) style.fills = fills
  }
  applyRangeReferences(style, override, text)
  return style
}

function buildStyleMap(table: NodeChange[], text: NodeChange): Map<number, CharacterStyleOverride> {
  const styleMap = new Map<number, CharacterStyleOverride>()
  for (const override of table) {
    const id = override.styleID as number | undefined
    // Characters with style 0 have the text's own.
    if (id === undefined || id === 0) continue
    const style = convertStyleOverride(override, text)
    if (Object.keys(style).length > 0) styleMap.set(id, style)
  }
  return styleMap
}

function collectStyleRuns(
  ids: number[],
  styleMap: Map<number, CharacterStyleOverride>
): StyleRun[] {
  const runs: StyleRun[] = []
  let currentId = ids[0]
  let start = 0

  for (let i = 1; i <= ids.length; i++) {
    if (i === ids.length || ids[i] !== currentId) {
      const style = styleMap.get(currentId)
      if (style) runs.push({ start, length: i - start, style })
      if (i < ids.length) {
        currentId = ids[i]
        start = i
      }
    }
  }
  return runs
}

/**
 * A link the text keeps for itself goes on every character, apart from those that name their
 * own: the model keeps links on ranges only.
 */
function withTextLink(
  ids: number[],
  length: number,
  styleMap: Map<number, CharacterStyleOverride>,
  link: HyperlinkTarget
): number[] {
  for (const style of styleMap.values()) style.hyperlink ??= link
  styleMap.set(0, { hyperlink: link })
  return Array.from({ length }, (_, index) => ids[index] ?? 0)
}

export function importStyleRuns(nc: NodeChange): StyleRun[] {
  const td = nc.textData
  const link = importHyperlink(nc.hyperlink)
  const length = td?.characters.length ?? 0
  const styleMap = buildStyleMap(td?.styleOverrideTable ?? [], nc)
  const ids = link
    ? withTextLink(td?.characterStyleIDs ?? [], length, styleMap, link)
    : (td?.characterStyleIDs ?? [])
  if (ids.length === 0 || styleMap.size === 0) return []
  return collectStyleRuns(ids, styleMap)
}
