import { getGlyphOutlineCommandsSync } from '../clipboard-text-outlines'
import { normalizeFontFamily, weightToStyle } from '../text/fonts'

import type { SceneNode } from '../scene-graph'
import type { NodeChange } from './codec'

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
  const glyphCommandLists = getGlyphOutlineCommandsSync(node.fontFamily, style, node.text, node.fontSize) ?? []

  const glyphs = glyphCommandLists.map((commands, index) => {
    const shapedGlyph = shaped?.glyphs[index]
    return {
      commands,
      position: {
        x: shapedGlyph?.x ?? 0,
        y: shapedGlyph?.y ?? (shaped?.baseline ?? lineHeightFallback)
      },
      fontSize: node.fontSize,
      firstCharacter: shapedGlyph?.firstCharacter ?? index,
      advance: shapedGlyph?.advance ?? 0,
      rotation: 0
    }
  })

  return {
    layoutSize: { x: node.width, y: node.height },
    baselines: [
      {
        firstCharacter: 0,
        endCharacter: Math.max(node.text.length - 1, 0),
        position: { x: 0, y: shaped?.baseline ?? lineHeightFallback },
        width: shaped?.lineWidth ?? node.width,
        lineHeight: shaped?.lineHeight ?? lineHeightFallback,
        lineAscent: shaped?.lineAscent ?? Math.max(lineHeightFallback - (node.fontSize * 0.2), 0)
      }
    ],
    glyphs,
    fontMetaData: [
      {
        key: { family: normalizedFamily, style, postscript: '' },
        fontLineHeight: 1.2,
        fontDigest: digestMap.get(key),
        fontStyle: node.italic ? 'ITALIC' : 'NORMAL',
        fontWeight: node.fontWeight
      }
    ],
    logicalIndexToCharacterOffsetMap:
      shaped?.logicalIndexToCharacterOffsetMap ?? Array.from({ length: node.text.length + 1 }, () => 0),
    derivedLines: [{ directionality: 'LTR' }],
    truncationStartIndex: -1,
    truncatedHeight: -1
  }
}
