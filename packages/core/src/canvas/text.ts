import type {
  CanvasKit,
  FontWeight,
  Paragraph,
  TextFontFeatures,
  TextFontVariations,
  TypefaceFontProvider
} from 'canvaskit-wasm'
import { uniq } from 'es-toolkit/array'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import type { SceneNode } from '@open-pencil/scene-graph'

import { getCanvasKit } from '#core/canvaskit'
import { resolveRGBAForPreview } from '#core/color/management'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { textNeededFallbackScripts } from '#core/text/coverage'
import { resolveNodeTextDirection } from '#core/text/direction'
import { fontManager, weightToStyle } from '#core/text/fonts'

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
  baselines?: NonNullable<NodeChange['derivedTextData']>['baselines']
  glyphs: ClipboardShapedGlyph[]
  logicalIndexToCharacterOffsetMap: number[]
}

const FONT_FAMILY_CACHE_LIMIT = 256
const fontFamilyCache = new Map<string, string[]>()

function hasRequiredFallbackFonts(node: SceneNode): boolean {
  for (const script of textNeededFallbackScripts(node)) {
    if (script === 'arabic' && fontManager.getArabicFallbackFamilies().length === 0) return false
    if (script !== 'arabic' && fontManager.getCJKFallbackFamilies().length === 0) return false
  }
  return true
}

export function isNodeFontLoaded(_r: TextRenderer, node: SceneNode): boolean {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  if (!fontManager.isStyleLoaded(baseFamily, weightToStyle(node.fontWeight, node.italic))) {
    return false
  }

  for (const run of node.styleRuns) {
    const family = run.style.fontFamily ?? baseFamily
    const weight = run.style.fontWeight ?? node.fontWeight
    const italic = run.style.italic ?? node.italic
    if (!fontManager.isStyleLoaded(family, weightToStyle(weight, italic))) return false
  }

  return hasRequiredFallbackFonts(node)
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

function resolveParagraphFontFamilies(
  primary: string,
  style: string,
  arabicFallbacks: readonly string[],
  cjkFallbacks: readonly string[]
): string[] {
  const renderPrimary = fontManager.renderFamily(primary, style)
  const key = `${renderPrimary}\0${arabicFallbacks.join('\0')}\0${cjkFallbacks.join('\0')}`
  const cached = fontFamilyCache.get(key)
  if (cached) return cached

  const families = [renderPrimary]
  if (primary !== DEFAULT_FONT_FAMILY) families.push(DEFAULT_FONT_FAMILY)
  families.push(...arabicFallbacks, ...cjkFallbacks)

  const resolved = uniq(families)
  fontFamilyCache.set(key, resolved)
  if (fontFamilyCache.size > FONT_FAMILY_CACHE_LIMIT) {
    const oldestKey = fontFamilyCache.keys().next().value
    if (oldestKey) fontFamilyCache.delete(oldestKey)
  }
  return resolved
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

export function textFontVariations(
  variations: SceneNode['fontVariations'] | undefined
): TextFontVariations[] | undefined {
  if (!variations || variations.length === 0) return undefined
  return variations.map((variation) => ({ axis: variation.axis, value: variation.value }))
}

export function textFontFeatures(
  features: SceneNode['fontFeatures'] | undefined
): TextFontFeatures[] | undefined {
  if (!features || features.length === 0) return undefined
  return features.map((feature) => ({
    name: feature.tag.toLowerCase(),
    value: feature.enabled ? 1 : 0
  }))
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

export function textDecorationStyleValue<T>(
  ck: { DecorationStyle: { Solid: T; Dotted: T; Wavy: T } },
  style: SceneNode['textDecorationStyle'] | undefined
): T {
  switch (style) {
    case 'DOTTED':
      return ck.DecorationStyle.Dotted
    case 'WAVY':
      return ck.DecorationStyle.Wavy
    default:
      return ck.DecorationStyle.Solid
  }
}

export function textHeightBehaviorValue<T>(
  ck: { TextHeightBehavior: { DisableAll: T } },
  leadingTrim: SceneNode['leadingTrim']
): T | undefined {
  return leadingTrim === 'CAP_HEIGHT' ? ck.TextHeightBehavior.DisableAll : undefined
}

function textDecorationColor(
  ck: CanvasKit,
  fills: SceneNode['textDecorationFills'] | undefined,
  fallback: Float32Array
): Float32Array {
  const fill = fills?.find((item) => item.visible && item.type === 'SOLID')
  if (!fill) return fallback
  const color = resolveRGBAForPreview(fill.color).color
  return ck.Color4f(color.r, color.g, color.b, color.a * fill.opacity)
}

function styleRunColor(
  ck: CanvasKit,
  style: SceneNode['styleRuns'][number]['style'],
  baseColor: Float32Array
): Float32Array {
  const visibleFill = style.fills?.find((fill) => fill.visible && fill.type === 'SOLID')
  if (!visibleFill) return baseColor
  const color = resolveRGBAForPreview(visibleFill.color).color
  return ck.Color4f(color.r, color.g, color.b, color.a * visibleFill.opacity)
}

function pushStyleRun(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: SceneNode,
  run: SceneNode['styleRuns'][number],
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, weight: number, italic?: boolean) => string[],
  halfLeading: boolean
): void {
  const ck = r.ck
  const style = run.style
  const runLineHeight = style.lineHeight !== undefined ? style.lineHeight : node.lineHeight
  const runFontSize = style.fontSize ?? baseFontSize

  builder.pushStyle(
    new ck.TextStyle({
      color: styleRunColor(ck, style, baseColor),
      fontFamilies: fontFamilies(
        style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY),
        style.fontWeight ?? node.fontWeight,
        style.italic ?? node.italic
      ),
      fontSize: runFontSize,
      fontStyle: {
        weight: { value: style.fontWeight ?? node.fontWeight } as FontWeight,
        slant: (style.italic ?? node.italic) ? ck.FontSlant.Italic : ck.FontSlant.Upright
      },
      fontVariations: textFontVariations(style.fontVariations ?? node.fontVariations),
      fontFeatures: textFontFeatures(style.fontFeatures ?? node.fontFeatures),
      letterSpacing: style.letterSpacing ?? (node.letterSpacing || 0),
      decoration: textDecorationValue(ck, style.textDecoration ?? node.textDecoration),
      decorationStyle: textDecorationStyleValue(
        ck,
        style.textDecorationStyle ?? node.textDecorationStyle
      ),
      decorationThickness:
        style.textDecorationThickness ?? node.textDecorationThickness ?? undefined,
      decorationColor: textDecorationColor(
        ck,
        style.textDecorationFills ?? node.textDecorationFills,
        baseColor
      ),
      heightMultiplier: runLineHeight ? runLineHeight / runFontSize : undefined,
      halfLeading
    })
  )
}

function addStyledRuns(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: SceneNode,
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, weight: number, italic?: boolean) => string[],
  halfLeading: boolean
): void {
  const text = node.text
  let pos = 0

  for (const run of node.styleRuns) {
    if (pos < run.start) builder.addText(text.slice(pos, run.start))
    pushStyleRun(r, builder, node, run, baseColor, baseFontSize, fontFamilies, halfLeading)
    builder.addText(text.slice(run.start, run.start + run.length))
    builder.pop()
    pos = run.start + run.length
  }

  if (pos < text.length) builder.addText(text.slice(pos))
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
  const cjkFallbacks = fontManager.getCJKFallbackFamilies()
  const arabicFallbacks = fontManager.getArabicFallbackFamilies()
  const textDirection = resolveNodeTextDirection(node)

  const truncateOpts = buildTruncateOpts(node, baseFontSize)

  const fontFamilies = (primary: string, weight: number, italic = false) =>
    resolveParagraphFontFamilies(
      primary,
      weightToStyle(weight, italic),
      arabicFallbacks,
      cjkFallbacks
    )

  const paraStyle = new ck.ParagraphStyle({
    textAlign: getParagraphTextAlign(ck, node),
    textDirection: textDirection === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textHeightBehavior: textHeightBehaviorValue(ck, node.leadingTrim),
    ...truncateOpts,
    textStyle: {
      color: baseColor,
      fontFamilies: fontFamilies(
        node.fontFamily || DEFAULT_FONT_FAMILY,
        node.fontWeight,
        node.italic
      ),
      fontSize: baseFontSize,
      fontStyle: {
        weight: { value: node.fontWeight } as FontWeight,
        slant: node.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
      },
      fontVariations: textFontVariations(node.fontVariations),
      fontFeatures: textFontFeatures(node.fontFeatures),
      letterSpacing: node.letterSpacing || 0,
      decoration: textDecorationValue(ck, node.textDecoration),
      decorationStyle: textDecorationStyleValue(ck, node.textDecorationStyle),
      decorationThickness: node.textDecorationThickness ?? undefined,
      decorationColor: textDecorationColor(ck, node.textDecorationFills, baseColor),
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

function addShapedRunGlyphs(
  run: ReturnType<Paragraph['getShapedLines']>[number]['runs'][number],
  glyphs: ClipboardShapedGlyph[],
  logicalIndexToCharacterOffsetMap: number[],
  fallbackLineY: number,
  fallbackLineWidth: number
): void {
  const positions = run.positions
  for (let i = 0; i < run.glyphs.length; i++) {
    const x = positions[i * 2] ?? 0
    const y = positions[i * 2 + 1] ?? fallbackLineY
    const nextX = positions[(i + 1) * 2] ?? x
    const glyphCharacter = run.offsets[i] ?? i
    glyphs.push({
      glyphIndex: i,
      firstCharacter: glyphCharacter,
      x,
      y,
      advance: nextX - x
    })
    if (glyphCharacter >= 0 && glyphCharacter < logicalIndexToCharacterOffsetMap.length) {
      logicalIndexToCharacterOffsetMap[glyphCharacter] = x
    }
  }

  const finalOffset = run.offsets[run.offsets.length - 1]
  const finalX = positions[positions.length - 2] ?? fallbackLineWidth
  if (finalOffset >= 0 && finalOffset < logicalIndexToCharacterOffsetMap.length) {
    logicalIndexToCharacterOffsetMap[finalOffset] = finalX
  }
}

function addLineBaseline(
  metrics: ReturnType<Paragraph['getLineMetrics']>[number],
  textLength: number,
  baselines: NonNullable<ClipboardShapedText['baselines']>
): void {
  if (metrics.startIndex >= textLength) return
  baselines.push({
    firstCharacter: metrics.startIndex,
    endCharacter: metrics.endIndex,
    position: { x: 0, y: metrics.baseline },
    width: metrics.width,
    lineY: metrics.startIndex === 0 ? 0 : metrics.baseline - Math.abs(metrics.ascent),
    lineHeight: metrics.height,
    lineAscent: Math.abs(metrics.ascent)
  })
}

export async function shapeTextForClipboard(node: SceneNode): Promise<ClipboardShapedText | null> {
  const ck = await getCanvasKit()
  const fontProvider = fontManager.provider()
  if (!fontProvider) return null

  const paragraph = buildParagraph({ ck, fontProvider, fontsLoaded: true }, node)
  paragraph.layout(node.textAutoResize === 'WIDTH_AND_HEIGHT' ? 1e6 : node.width)
  const shapedLines = paragraph.getShapedLines()
  const lineMetrics = paragraph.getLineMetrics()
  if (shapedLines.length === 0 || lineMetrics.length === 0) {
    paragraph.delete()
    return null
  }
  const firstMetrics = lineMetrics[0]

  const glyphs: ClipboardShapedGlyph[] = []
  const baselines: NonNullable<ClipboardShapedText['baselines']> = []
  const logicalIndexToCharacterOffsetMap = Array.from({ length: node.text.length + 1 }, () => 0)

  for (let lineIdx = 0; lineIdx < shapedLines.length; lineIdx++) {
    const line = shapedLines[lineIdx]
    const metrics = lineMetrics[lineIdx] ?? firstMetrics
    const lineY = metrics.baseline
    for (const run of line.runs) {
      addShapedRunGlyphs(run, glyphs, logicalIndexToCharacterOffsetMap, lineY, metrics.width)
    }
    addLineBaseline(metrics, node.text.length, baselines)
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
    baselines,
    glyphs,
    logicalIndexToCharacterOffsetMap
  }
}
