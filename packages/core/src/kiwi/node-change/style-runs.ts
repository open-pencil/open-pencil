import { styleToWeight } from '#core/text/fonts'

import { convertFills } from './paint'
import { convertLetterSpacing, convertLineHeight, mapTextDecoration } from './text-values'

import type { NodeChange } from '#core/kiwi/binary/codec'
import type { CharacterStyleOverride, StyleRun } from '#core/scene-graph'

function convertStyleOverride(
  override: NodeChange,
  fallbackFontSize: number | undefined
): CharacterStyleOverride {
  const style: CharacterStyleOverride = {}
  if (override.fontName) {
    style.fontFamily = override.fontName.family
    style.fontWeight = styleToWeight(override.fontName.style)
    style.italic = override.fontName.style.toLowerCase().includes('italic')
  }
  if (override.fontSize !== undefined) style.fontSize = override.fontSize
  if (override.letterSpacing) {
    style.letterSpacing = convertLetterSpacing(
      override.letterSpacing,
      override.fontSize ?? fallbackFontSize
    )
  }
  if (override.lineHeight) {
    const lh = convertLineHeight(override.lineHeight, override.fontSize ?? fallbackFontSize)
    if (lh != null) style.lineHeight = lh
  }
  const deco = override.textDecoration
  if (deco) style.textDecoration = mapTextDecoration(deco)
  if (override.fillPaints) {
    const fills = convertFills(override.fillPaints)
    if (fills.length > 0) style.fills = fills
  }
  return style
}

function buildStyleMap(
  table: NodeChange[],
  fallbackFontSize: number | undefined
): Map<number, CharacterStyleOverride> {
  const styleMap = new Map<number, CharacterStyleOverride>()
  for (const override of table) {
    const id = override.styleID as number | undefined
    if (id === undefined) continue
    const style = convertStyleOverride(override, fallbackFontSize)
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
      if (currentId !== 0) {
        const style = styleMap.get(currentId)
        if (style) runs.push({ start, length: i - start, style })
      }
      if (i < ids.length) {
        currentId = ids[i]
        start = i
      }
    }
  }
  return runs
}

export function importStyleRuns(nc: NodeChange): StyleRun[] {
  const td = nc.textData
  if (!td?.characterStyleIDs || !td.styleOverrideTable) return []

  const ids = td.characterStyleIDs
  if (ids.length === 0 || td.styleOverrideTable.length === 0) return []

  const styleMap = buildStyleMap(td.styleOverrideTable, nc.fontSize)
  if (styleMap.size === 0) return []

  return collectStyleRuns(ids, styleMap)
}
