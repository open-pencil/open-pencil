import type { NodeChange } from '#core/kiwi/binary/codec'
import type { SceneNode } from '#core/scene-graph'

import { buildDerivedTextData } from './derived-text-data'
import { normalizeFontFamily, weightToFigmaStyle, weightToStyle } from './fonts'
import { getGlyphOutlineMetricsSync } from './opentype'

export interface ShapedClipboardText {
  lineHeight: number
  lineAscent: number
  lineWidth: number
  baseline: number
  glyphs: Array<{
    firstCharacter: number
    x: number
    y: number
    advance: number
  }>
  logicalIndexToCharacterOffsetMap: number[]
}

export async function buildDerivedTextDataV4(
  node: SceneNode,
  digestMap: Map<string, Uint8Array>,
  shaped?: ShapedClipboardText | null
): Promise<NodeChange['derivedTextData']> {
  const style = weightToStyle(node.fontWeight, node.italic)
  const normalizedFamily = normalizeFontFamily(node.fontFamily)
  const key = `${normalizedFamily}|${style}`
  const lineHeightFallback = node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
  const glyphMetrics = getGlyphOutlineMetricsSync(node.fontFamily, style, node.text, node.fontSize) ?? []

  const fallbackAdvance = node.text.length > 0 ? node.width / Math.max(node.text.length, 1) : 0
  const glyphs = glyphMetrics.map((glyph, index) => {
    const shapedGlyph = shaped?.glyphs[index]
    const fallbackX = glyph.x || index * fallbackAdvance
    const fallbackGlyphAdvance = glyph.advance || fallbackAdvance
    return {
      commands: glyph.commands,
      position: {
        x: shapedGlyph?.x ?? fallbackX,
        y: shapedGlyph?.y ?? shaped?.baseline ?? lineHeightFallback
      },
      fontSize: node.fontSize,
      firstCharacter: shapedGlyph?.firstCharacter ?? index,
      advance: shapedGlyph?.advance ?? fallbackGlyphAdvance,
      rotation: 0
    }
  })

  return buildDerivedTextData({
    node,
    glyphs,
    fontMetaData: [
      {
        key: { family: normalizedFamily, style: weightToFigmaStyle(node.fontWeight, node.italic), postscript: '' },
        fontLineHeight: 1.2,
        fontDigest: digestMap.get(key),
        fontStyle: node.italic ? 'ITALIC' : 'NORMAL',
        fontWeight: node.fontWeight
      }
    ],
    baseline: shaped?.baseline ?? lineHeightFallback,
    width: shaped?.lineWidth ?? node.width,
    lineHeight: shaped?.lineHeight ?? lineHeightFallback,
    lineAscent: shaped?.lineAscent ?? Math.max(lineHeightFallback - node.fontSize * 0.2, 0),
    logicalIndexToCharacterOffsetMap:
      shaped?.logicalIndexToCharacterOffsetMap ??
      Array.from({ length: node.text.length + 1 }, (_, index) => index * fallbackAdvance)
  })
}
