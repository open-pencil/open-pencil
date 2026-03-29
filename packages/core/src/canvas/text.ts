import { resolveRGBAForPreview } from '../color/management'
import { getCanvasKit } from '../canvaskit'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '../constants'
import { resolveNodeTextDirection } from '../text/direction'
import {
  getArabicFallbackFamilies,
  getCJKFallbackFamilies,
  getFontProvider,
  isFontLoaded
} from '../text/fonts'

import type { SceneNode } from '../scene-graph'
import type { CanvasKit, FontWeight, Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'

interface TextRenderer {
  ck: CanvasKit
  fontProvider: TypefaceFontProvider | null
  fontsLoaded: boolean
}

export interface ClipboardShapedGlyph {
  glyphIndex: number
  firstCharacter: number
  x: number
  y: number
  advance: number
}

export interface ClipboardShapedText {
  lineHeight: number
  lineAscent: number
  lineWidth: number
  baseline: number
  glyphs: ClipboardShapedGlyph[]
  logicalIndexToCharacterOffsetMap: number[]
}

export function isNodeFontLoaded(_r: TextRenderer, node: SceneNode): boolean {
  const families = new Set<string>()
  families.add(node.fontFamily || DEFAULT_FONT_FAMILY)
  for (const run of node.styleRuns) {
    if (run.style.fontFamily) families.add(run.style.fontFamily)
  }
  return [...families].every((f) => isFontLoaded(f))
}

export function measureTextNode(
  r: TextRenderer,
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } | null {
  if (!r.fontsLoaded || !r.fontProvider || !isNodeFontLoaded(r, node)) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const paragraph = buildParagraph(r, node)
  paragraph.layout(resolveParagraphLayoutWidth(node, maxWidth))
  const width = paragraph.getLongestLine()
  const height = paragraph.getHeight()
  paragraph.delete()
  return { width: Math.ceil(width), height: Math.ceil(height) }
}

export function buildTextPicture(r: TextRenderer, node: SceneNode): Uint8Array | null {
  if (!r.fontsLoaded || !r.fontProvider || !isNodeFontLoaded(r, node)) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const ck = r.ck
  const recorder = new ck.PictureRecorder()
  const bounds = ck.LTRBRect(0, 0, node.width || 1e6, node.height || 1e6)
  const recCanvas = recorder.beginRecording(bounds)

  const paragraph = buildParagraph(r, node)
  recCanvas.drawParagraph(paragraph, 0, 0)
  paragraph.delete()

  const picture = recorder.finishRecordingAsPicture()
  recorder.delete()

  const bytes = picture.serialize()
  picture.delete()
  return bytes ?? null
}

function resolveParagraphLayoutWidth(node: SceneNode, maxWidth?: number): number {
  if (maxWidth !== undefined) return maxWidth
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 1e6
  return node.width || 1e6
}

function buildTruncateOpts(
  node: SceneNode,
  baseFontSize: number
): { maxLines?: number; ellipsis?: string } {
  if (node.textTruncation !== 'ENDING') return {}

  const opts: { maxLines?: number; ellipsis: string } = { ellipsis: '…' }
  if (node.maxLines != null && node.maxLines > 0) {
    opts.maxLines = node.maxLines
  } else if (node.height > 0) {
    const lineH = node.lineHeight || baseFontSize * 1.2
    opts.maxLines = Math.max(1, Math.floor(node.height / lineH))
  }
  return opts
}

function getParagraphTextAlign(
  ck: CanvasKit,
  node: Pick<SceneNode, 'textAlignHorizontal' | 'textDirection' | 'text'>
) {
  const direction = resolveNodeTextDirection(node)
  switch (node.textAlignHorizontal) {
    case 'CENTER':
      return ck.TextAlign.Center
    case 'RIGHT':
      return direction === 'RTL' ? ck.TextAlign.Left : ck.TextAlign.Right
    case 'JUSTIFIED':
      return ck.TextAlign.Justify
    default:
      return direction === 'RTL' ? ck.TextAlign.Right : ck.TextAlign.Left
  }
}

function textDecorationValue(ck: CanvasKit, decoration: string): number {
  switch (decoration) {
    case 'UNDERLINE':
      return ck.UnderlineDecoration
    case 'STRIKETHROUGH':
      return ck.LineThroughDecoration
    default:
      return ck.NoDecoration
  }
}

function addStyledRuns(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: SceneNode,
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string) => string[],
  halfLeading: boolean
): void {
  const ck = r.ck
  const text = node.text
  let pos = 0

  for (const run of node.styleRuns) {
    if (pos < run.start) {
      builder.addText(text.slice(pos, run.start))
    }
    const s = run.style
    const runLineHeight = s.lineHeight !== undefined ? s.lineHeight : node.lineHeight
    const runFontSize = s.fontSize ?? baseFontSize

    let runColor = baseColor
    if (s.fills) {
      const visibleFill = s.fills.find((f) => f.visible && f.type === 'SOLID')
      if (visibleFill) {
        const c = resolveRGBAForPreview(visibleFill.color).color
        runColor = ck.Color4f(c.r, c.g, c.b, c.a * visibleFill.opacity)
      }
    }

    builder.pushStyle(
      new ck.TextStyle({
        color: runColor,
        fontFamilies: fontFamilies(s.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)),
        fontSize: runFontSize,
        fontStyle: {
          weight: { value: (s.fontWeight ?? node.fontWeight) || 400 } as FontWeight,
          slant: (s.italic ?? node.italic) ? ck.FontSlant.Italic : ck.FontSlant.Upright
        },
        letterSpacing: s.letterSpacing ?? (node.letterSpacing || 0),
        decoration: textDecorationValue(ck, s.textDecoration ?? node.textDecoration),
        heightMultiplier: runLineHeight ? runLineHeight / runFontSize : undefined,
        halfLeading
      })
    )
    builder.addText(text.slice(run.start, run.start + run.length))
    builder.pop()
    pos = run.start + run.length
  }

  if (pos < text.length) {
    builder.addText(text.slice(pos))
  }
}

export function buildParagraph(
  r: TextRenderer,
  node: SceneNode,
  color?: Float32Array,
  { halfLeading = false }: { halfLeading?: boolean } = {}
): Paragraph {
  const ck = r.ck
  const baseColor = color ?? ck.BLACK
  const baseFontSize = node.fontSize || DEFAULT_FONT_SIZE
  const cjkFallbacks = getCJKFallbackFamilies()
  const arabicFallbacks = getArabicFallbackFamilies()
  const textDirection = resolveNodeTextDirection(node)

  const truncateOpts = buildTruncateOpts(node, baseFontSize)

  const fontFamilies = (primary: string) => {
    const families = [primary]
    if (primary !== DEFAULT_FONT_FAMILY) families.push(DEFAULT_FONT_FAMILY)
    families.push(...arabicFallbacks)
    families.push(...cjkFallbacks)
    return [...new Set(families)]
  }

  const paraStyle = new ck.ParagraphStyle({
    textAlign: getParagraphTextAlign(ck, node),
    textDirection: textDirection === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    ...truncateOpts,
    textStyle: {
      color: baseColor,
      fontFamilies: fontFamilies(node.fontFamily || DEFAULT_FONT_FAMILY),
      fontSize: baseFontSize,
      fontStyle: {
        weight: { value: node.fontWeight || 400 } as FontWeight,
        slant: node.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
      },
      letterSpacing: node.letterSpacing || 0,
      decoration: textDecorationValue(ck, node.textDecoration),
      heightMultiplier: node.lineHeight ? node.lineHeight / baseFontSize : undefined,
      halfLeading
    }
  })

  if (!r.fontProvider) throw new Error('Font provider not initialized')
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, r.fontProvider)

  if (node.styleRuns.length === 0) {
    builder.addText(node.text)
  } else {
    addStyledRuns(r, builder, node, baseColor, baseFontSize, fontFamilies, halfLeading)
  }

  const paragraph = builder.build()
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    paragraph.layout(1e6)
    paragraph.layout(Math.max(node.width || 1, Math.ceil(paragraph.getLongestLine())))
  } else {
    paragraph.layout(resolveParagraphLayoutWidth(node))
  }
  builder.delete()
  return paragraph
}

export async function shapeTextForClipboard(node: SceneNode): Promise<ClipboardShapedText | null> {
  const ck = await getCanvasKit()
  const fontProvider = getFontProvider()
  if (!fontProvider) return null

  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node)
  const shapedLines = paragraph.getShapedLines()
  const lineMetrics = paragraph.getLineMetrics()
  const firstLine = shapedLines[0]
  const firstMetrics = lineMetrics[0]

  const glyphs: ClipboardShapedGlyph[] = []
  const logicalIndexToCharacterOffsetMap = Array.from({ length: node.text.length + 1 }, () => 0)

  for (const run of firstLine.runs) {
    const positions = run.positions
    for (let i = 0; i < run.glyphs.length; i++) {
      const x = positions[i * 2] ?? 0
      const y = positions[i * 2 + 1] ?? firstLine.baseline
      const nextX = positions[(i + 1) * 2] ?? x
      const firstCharacter = run.offsets[i] ?? i
      glyphs.push({
        glyphIndex: i,
        firstCharacter,
        x,
        y,
        advance: nextX - x
      })
      if (firstCharacter >= 0 && firstCharacter < logicalIndexToCharacterOffsetMap.length) {
        logicalIndexToCharacterOffsetMap[firstCharacter] = x
      }
    }
    const finalOffset = run.offsets[run.offsets.length - 1]
    const finalX = positions[positions.length - 2] ?? firstMetrics.width
    if (finalOffset >= 0 && finalOffset < logicalIndexToCharacterOffsetMap.length) {
      logicalIndexToCharacterOffsetMap[finalOffset] = finalX
    }
  }

  for (let i = 1; i < logicalIndexToCharacterOffsetMap.length; i++) {
    if (logicalIndexToCharacterOffsetMap[i] === 0) {
      logicalIndexToCharacterOffsetMap[i] = logicalIndexToCharacterOffsetMap[i - 1]
    }
  }

  paragraph.delete()

  return {
    lineHeight: firstMetrics.height,
    lineAscent: Math.abs(firstMetrics.ascent),
    lineWidth: firstMetrics.width,
    baseline: firstMetrics.baseline,
    glyphs,
    logicalIndexToCharacterOffsetMap
  }
}
