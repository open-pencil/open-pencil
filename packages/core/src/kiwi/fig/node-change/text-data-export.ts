import type { NodeChange, Paint } from '#core/kiwi/fig/codec'
import type { CharacterStyleOverride, SceneNode } from '#core/scene-graph'
import { normalizeFontFamily, weightToFigmaStyle } from '#core/text/fonts'

import { applyFontFeaturesToKiwi } from './font/features'
import { stringToFigmaAxisTag } from './font/variations'

export function fontVariationToKiwi(variation: SceneNode['fontVariations'][number]) {
  const axisTag = stringToFigmaAxisTag(variation.axis)
  return axisTag === undefined
    ? { axisName: variation.axis, value: variation.value }
    : { axisTag, axisName: variation.axis, value: variation.value }
}

function applyTextDecorationOverrideFields(
  override: Record<string, unknown>,
  style: CharacterStyleOverride,
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
): void {
  if (style.textDecoration) override.textDecoration = style.textDecoration
  if (style.textDecorationStyle) override.textDecorationStyle = style.textDecorationStyle
  if (style.textDecorationThickness != null) {
    override.textDecorationThickness = { value: style.textDecorationThickness, units: 'PIXELS' }
  }
  if (style.textDecorationSkipInk !== undefined)
    override.textDecorationSkipInk = style.textDecorationSkipInk
  if (style.textUnderlineOffset != null) {
    override.textUnderlineOffset = { value: style.textUnderlineOffset, units: 'PIXELS' }
  }
  if (style.textDecorationFills && style.textDecorationFills.length > 0) {
    override.textDecorationFillPaints = style.textDecorationFills.map(fillToKiwiPaint)
  }
}

function textStyleOverrideToKiwi(
  id: number,
  style: CharacterStyleOverride,
  node: SceneNode,
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
): NodeChange {
  const override: Record<string, unknown> = { styleID: id }
  const weight = style.fontWeight ?? node.fontWeight
  const italic = style.italic ?? node.italic
  override.fontName = {
    family: normalizeFontFamily(style.fontFamily ?? node.fontFamily),
    style: weightToFigmaStyle(weight, italic),
    postscript: ''
  }
  if (style.fontSize !== undefined) override.fontSize = style.fontSize
  if (style.fontVariations && style.fontVariations.length > 0) {
    override.fontVariations = style.fontVariations.map(fontVariationToKiwi)
  }
  if (style.fontFeatures && style.fontFeatures.length > 0) {
    applyFontFeaturesToKiwi(override as NodeChange, style.fontFeatures)
  }
  if (style.letterSpacing !== undefined) {
    override.letterSpacing = { value: style.letterSpacing, units: 'PIXELS' }
  }
  if (style.lineHeight !== undefined && style.lineHeight !== null) {
    override.lineHeight = { value: style.lineHeight, units: 'PIXELS' }
  }
  applyTextDecorationOverrideFields(override, style, fillToKiwiPaint)
  if (style.fills && style.fills.length > 0) {
    override.fillPaints = style.fills.map(fillToKiwiPaint)
  }
  return override as NodeChange
}

function collectTextStyleOverrides(node: SceneNode): {
  charIds: number[]
  styleMap: Map<string, { id: number; style: CharacterStyleOverride }>
} {
  const charIds = Array.from<number>({ length: node.text.length }).fill(0)
  const styleMap = new Map<string, { id: number; style: CharacterStyleOverride }>()
  let nextId = 1

  for (const run of node.styleRuns) {
    const key = JSON.stringify(run.style)
    let entry = styleMap.get(key)
    if (!entry) {
      entry = { id: nextId++, style: run.style }
      styleMap.set(key, entry)
    }
    for (let i = run.start; i < run.start + run.length && i < charIds.length; i++) {
      charIds[i] = entry.id
    }
  }

  return { charIds, styleMap }
}

export function exportTextData(
  node: SceneNode,
  textLines: (text: string) => NonNullable<NodeChange['textData']>['lines'],
  fillToKiwiPaint: (fill: SceneNode['fills'][number]) => Paint
): NodeChange['textData'] {
  if (node.styleRuns.length === 0) {
    return { characters: node.text, lines: textLines(node.text) }
  }

  const { charIds, styleMap } = collectTextStyleOverrides(node)
  const overrideTable = [...styleMap.values()].map(({ id, style }) =>
    textStyleOverrideToKiwi(id, style, node, fillToKiwiPaint)
  )

  return {
    characters: node.text,
    lines: textLines(node.text),
    characterStyleIDs: charIds,
    styleOverrideTable: overrideTable
  }
}
