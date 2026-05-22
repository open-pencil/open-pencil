import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

import type { NodeChange } from '#core/kiwi/fig/codec'
import { encodePathCommandsBlob } from '#core/kiwi/fig/node-change/path-commands'
import type { SceneNode } from '#core/scene-graph'
import { normalizeFontFamily, weightToFigmaStyle, weightToStyle } from '#core/text/fonts'
import { type GlyphOutlineMetrics, getGlyphOutlineMetricsSync } from '#core/text/opentype'

import { buildDerivedTextData } from './data'

function computeWordWrapBreaks(
  text: string,
  glyphMetrics: Array<Pick<GlyphOutlineMetrics, 'advance'>>,
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
  glyphMetrics: Array<Pick<GlyphOutlineMetrics, 'advance'>>,
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
    if (x > 0 && x + advance > maxWidth + 0.5) {
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
  baselines?: NonNullable<NodeChange['derivedTextData']>['baselines']
  glyphs: Array<{
    firstCharacter: number
    x: number
    y: number
    advance: number
  }>
  logicalIndexToCharacterOffsetMap: number[]
}

type DerivedGlyphMetric = { advance: number; commands: GlyphOutlineMetrics['commands'] }

function buildTextGlyphs(
  text: string,
  glyphMetrics: GlyphOutlineMetrics[],
  fallbackAdvance: number,
  fontSize: number
): DerivedGlyphMetric[] {
  if (glyphMetrics.length > 0) {
    return glyphMetrics.map((glyph) => ({
      advance: glyph.advance || fallbackAdvance,
      commands: glyph.commands
    }))
  }
  return Array.from({ length: text.length }, () => ({
    advance: fallbackAdvance || fontSize * 0.6,
    commands: []
  }))
}

function computeLineBreaks(
  node: SceneNode,
  glyphMetrics: GlyphOutlineMetrics[],
  textGlyphs: DerivedGlyphMetric[],
  fallbackAdvance: number,
  shaped?: ShapedClipboardText | null
): number[] {
  if (shaped) return []
  if (glyphMetrics.length > 0) {
    return computeWordWrapBreaks(
      node.text,
      textGlyphs,
      fallbackAdvance,
      node.width,
      node.fontSize,
      node.fontFamily
    )
  }
  return computeFallbackBreaks(node.text, textGlyphs, fallbackAdvance, node.width)
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
  const glyphMetrics =
    getGlyphOutlineMetricsSync(node.fontFamily, style, node.text, node.fontSize) ?? []

  const fallbackAdvance = node.text.length > 0 ? node.width / Math.max(node.text.length, 1) : 0
  const textGlyphs = buildTextGlyphs(node.text, glyphMetrics, fallbackAdvance, node.fontSize)
  const lineAscent = Math.max(lineHeightFallback - node.fontSize * 0.2, 0)
  const lineBreaks = computeLineBreaks(node, glyphMetrics, textGlyphs, fallbackAdvance, shaped)
  const lineBreakSet = new Set(lineBreaks)

  const shapedByChar = new Map<
    number,
    (typeof shaped extends null | undefined ? never : NonNullable<typeof shaped>)['glyphs'][number]
  >()
  if (shaped) {
    for (const g of shaped.glyphs) shapedByChar.set(g.firstCharacter, g)
  }

  const fallbackBaselines: NonNullable<NodeChange['derivedTextData']>['baselines'] = []
  const fallbackOffsets = Array.from({ length: node.text.length + 1 }, () => 0)
  let fallbackX = 0
  let fallbackY = lineHeightFallback
  let lineStart = 0

  const glyphs = textGlyphs.map((glyph, index) => {
    const shapedGlyph = shapedByChar.get(index)
    const fallbackGlyphAdvance = glyph.advance || fallbackAdvance
    if (!shapedGlyph && lineBreakSet.has(index)) {
      fallbackBaselines.push({
        firstCharacter: lineStart,
        endCharacter: index,
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
    const commandsBlob =
      blobs && glyph.commands.length > 0
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
      endCharacter: node.text.length,
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
        key: {
          family: normalizedFamily,
          style: weightToFigmaStyle(node.fontWeight, node.italic),
          postscript: ''
        },
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
    baselines: shaped ? shaped.baselines : fallbackBaselines,
    logicalIndexToCharacterOffsetMap: shaped?.logicalIndexToCharacterOffsetMap ?? fallbackOffsets
  })
}
