import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

import type { NodeChange } from '#core/kiwi/binary/codec'
import type { SceneNode } from '#core/scene-graph'

import { encodePathCommandsBlob } from '#core/kiwi/node-change/path-commands'

import { normalizeFontFamily, weightToFigmaStyle, weightToStyle } from '#core/text/fonts'
import { type GlyphOutlineMetrics, getGlyphOutlineMetricsSync } from '#core/text/opentype'

import { buildDerivedTextData } from './data'

function computeWordWrapBreaks(
  text: string,
  glyphMetrics: GlyphOutlineMetrics[],
  fallbackAdvance: number,
  maxWidth: number,
  fontSize: number,
  fontFamily: string
): number[] {
  try {
    const font = `${fontSize}px ${fontFamily}`
    const prepared = prepareWithSegments(text, font)
    const lineHeight = Math.ceil(fontSize * 1.2)
    const { lines } = layoutWithLines(prepared, maxWidth, lineHeight)
    const breaks: number[] = []
    let charOffset = 0
    for (const line of lines) {
      if (charOffset > 0) breaks.push(charOffset)
      charOffset += line.text.length
    }
    return breaks
  } catch {
    return computeFallbackBreaks(text, glyphMetrics, fallbackAdvance, maxWidth)
  }
}

function computeFallbackBreaks(
  text: string,
  glyphMetrics: GlyphOutlineMetrics[],
  fallbackAdvance: number,
  maxWidth: number
): number[] {
  const breaks: number[] = []
  let x = 0
  let lastBreak = 0
  let lastBreakX = 0

  for (let i = 0; i < glyphMetrics.length; i++) {
    const advance = glyphMetrics[i].advance || fallbackAdvance
    const ch = text[i]
    if (ch === ' ' || ch === '\t' || (ch === '-' && i + 1 < text.length)) {
      lastBreak = i + 1
      lastBreakX = x + advance
    }
    if (x > 0 && x + advance > maxWidth) {
      const lineStart = breaks.length > 0 ? breaks[breaks.length - 1] : 0
      if (lastBreak > lineStart) {
        breaks.push(lastBreak)
        x -= lastBreakX
      } else {
        breaks.push(i)
        x = 0
      }
      lastBreak = breaks[breaks.length - 1]
      lastBreakX = 0
    }
    x += advance
  }
  return breaks
}

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
  shaped?: ShapedClipboardText | null,
  blobs?: Uint8Array[]
): Promise<NodeChange['derivedTextData']> {
  const style = weightToStyle(node.fontWeight, node.italic)
  const normalizedFamily = normalizeFontFamily(node.fontFamily)
  const key = `${normalizedFamily}|${style}`
  const lineHeightFallback = node.lineHeight ?? Math.ceil(node.fontSize * 1.2)
  const glyphMetrics = getGlyphOutlineMetricsSync(node.fontFamily, style, node.text, node.fontSize) ?? []

  const fallbackAdvance = node.text.length > 0 ? node.width / Math.max(node.text.length, 1) : 0
  const lineAscent = Math.max(lineHeightFallback - node.fontSize * 0.2, 0)
  const lineBreaks = shaped
    ? []
    : computeWordWrapBreaks(node.text, glyphMetrics, fallbackAdvance, node.width, node.fontSize, node.fontFamily)
  const lineBreakSet = new Set(lineBreaks)

  const shapedByChar = new Map<number, (typeof shaped extends null | undefined ? never : NonNullable<typeof shaped>)['glyphs'][number]>()
  if (shaped) {
    for (const g of shaped.glyphs) shapedByChar.set(g.firstCharacter, g)
  }

  const fallbackBaselines: NonNullable<NodeChange['derivedTextData']>['baselines'] = []
  const fallbackOffsets = Array.from({ length: node.text.length + 1 }, () => 0)
  let fallbackX = 0
  let fallbackY = lineHeightFallback
  let lineStart = 0

  const glyphs = glyphMetrics.map((glyph, index) => {
    const shapedGlyph = shapedByChar.get(index)
    const fallbackGlyphAdvance = glyph.advance || fallbackAdvance
    if (!shapedGlyph && lineBreakSet.has(index)) {
      fallbackBaselines.push({
        firstCharacter: lineStart,
        endCharacter: Math.max(index - 1, lineStart),
        position: { x: 0, y: fallbackY },
        width: fallbackX,
        lineHeight: lineHeightFallback,
        lineAscent
      })
      lineStart = index
      fallbackX = 0
      fallbackY += lineHeightFallback
    }
    const glyphX = fallbackX
    fallbackOffsets[index] = glyphX
    fallbackX += fallbackGlyphAdvance
    const commandsBlob = blobs
      ? blobs.push(encodePathCommandsBlob(glyph.commands, node.fontSize)) - 1
      : undefined
    return {
      commandsBlob,
      position: {
        x: shapedGlyph?.x ?? glyphX,
        y: shapedGlyph?.y ?? shaped?.baseline ?? fallbackY
      },
      fontSize: node.fontSize,
      firstCharacter: shapedGlyph?.firstCharacter ?? index,
      advance: (shapedGlyph?.advance ?? fallbackGlyphAdvance) / node.fontSize,
      rotation: 0
    }
  })
  fallbackOffsets[node.text.length] = fallbackX
  if (node.text.length > 0) {
    fallbackBaselines.push({
      firstCharacter: lineStart,
      endCharacter: node.text.length - 1,
      position: { x: 0, y: fallbackY },
      width: fallbackX,
      lineHeight: lineHeightFallback,
      lineAscent
    })
  }

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
    lineAscent: shaped?.lineAscent ?? lineAscent,
    baselines: shaped ? undefined : fallbackBaselines,
    logicalIndexToCharacterOffsetMap: shaped?.logicalIndexToCharacterOffsetMap ?? fallbackOffsets
  })
}
