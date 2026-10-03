import type {
  CanvasKit,
  FontWeight,
  Paint,
  Paragraph,
  TextFontFeatures,
  TextFontVariations,
  TypefaceFontProvider
} from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { resolveRGBAForPreview } from '@open-pencil/scene-graph/color'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text-direction'

import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { transformTextCase } from '#core/text/case'
import { fontManager, weightToStyle } from '#core/text/fonts'
import {
  fontCoverageDemand,
  fontFaceDemand,
  fontRemoteCoverageDemand,
  fontResolver,
  missingGlyphOccurrences,
  missingGlyphsByScript,
  type FontResolutionSettled
} from '#core/text/resolver'

import { resolveParagraphFontFamilies } from './font-families'
import { pushParagraphStyle, type ParagraphPaintStyle, type ParagraphBuildOptions } from './paint'
import { withPreparedText } from './prepared'
export { withTextParagraph } from './prepared'
export type { ParagraphBuildOptions } from './paint'
import type { ParagraphNode } from './paragraph-inputs'
import type { TextPreparationCache } from './preparation-cache'

interface FontReadinessRenderer {
  textPreparationCache?: TextPreparationCache
  ck?: CanvasKit
  fontProvider?: TypefaceFontProvider | null
  fontsLoaded?: boolean
  onFontResolutionSettled?: FontResolutionSettled
  trackFontDemand?: (node: SceneNode, key: string) => void
}

interface TextRenderer extends FontReadinessRenderer {
  ck: CanvasKit
  fontProvider: TypefaceFontProvider | null
  fontsLoaded: boolean
}

function demandFace(
  r: FontReadinessRenderer,
  node: SceneNode,
  family: string,
  style: string
): boolean {
  if (fontManager.isStyleLoaded(family, style)) return true
  const demand = fontFaceDemand(family, style, node.text)
  r.trackFontDemand?.(node, demand.key)
  void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
  return false
}

function requiredNodeFaces(node: SceneNode): Array<{ family: string; style: string }> {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  const faces = new Map<string, { family: string; style: string }>()
  const add = (family: string, style: string) => faces.set(`${family}\0${style}`, { family, style })
  add(baseFamily, weightToStyle(node.fontWeight, node.italic))
  for (const run of node.styleRuns) {
    const family = run.style.fontFamily ?? baseFamily
    const weight = run.style.fontWeight ?? node.fontWeight
    const italic = run.style.italic ?? node.italic
    add(family, weightToStyle(weight, italic))
  }
  return Array.from(faces.values())
}

function languageForCharacter(node: SceneNode, sourceIndex: number): string | null {
  const run = node.styleRuns.find(
    (item) => sourceIndex >= item.start && sourceIndex < item.start + item.length
  )
  return run?.style.textLanguage ?? node.textLanguage
}

function transformedSourceOffsets(node: SceneNode): number[] {
  const offsets: number[] = []
  let sourceIndex = 0
  for (const sourceCharacter of node.text) {
    for (const _character of transformTextCase(sourceCharacter, node.textCase)) {
      offsets.push(sourceIndex)
    }
    sourceIndex += sourceCharacter.length
  }
  return offsets
}

export type NodeFontReadiness = 'ready' | 'substituted' | 'pending' | 'exhausted'

function requiredFacesReadiness(r: FontReadinessRenderer, node: SceneNode): NodeFontReadiness {
  let pending = false
  let exhausted = false
  for (const { family, style } of requiredNodeFaces(node)) {
    if (fontManager.isStyleLoaded(family, style)) continue
    const demand = fontFaceDemand(family, style, node.text)
    const state = fontResolver.state(demand).state
    demandFace(r, node, family, style)
    if (state === 'failed' || state === 'exhausted') {
      // CanvasKit can synthesize a missing slant or weight from another loaded face in the same
      // family. Keep the text visible when an exact face (for example, Italic) is unavailable.
      if (fontManager.isLoaded(family)) continue
      exhausted = true
    } else {
      pending = true
    }
  }
  if (pending) return 'pending'
  if (exhausted && fontManager.isStyleLoaded(DEFAULT_FONT_FAMILY, 'Regular')) return 'substituted'
  return exhausted ? 'exhausted' : 'ready'
}

function demandRemoteCoverage(r: TextRenderer, node: SceneNode, characters: string[]): boolean {
  for (const { family, style } of requiredNodeFaces(node)) {
    if (!fontManager.remoteStyleNeedsCoverage(family, style, characters)) continue
    const demand = fontRemoteCoverageDemand(family, style, characters)
    const state = fontResolver.state(demand).state
    if (state === 'idle') {
      r.trackFontDemand?.(node, demand.key)
      void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
      return true
    }
    if (state === 'loading') return true
    if (state === 'loaded') fontResolver.exhaust(demand)
  }
  return false
}

function observedGlyphReadiness(r: TextRenderer, node: SceneNode): NodeFontReadiness {
  if (
    r.fontProvider &&
    r.textPreparationCache?.hasGlyphCoverage(node, fontManager.generation(), r.fontProvider)
  )
    return 'ready'

  const missingOccurrences = withPreparedText(
    r,
    node,
    'coverage',
    () => buildParagraph(r, node),
    (prepared) => {
      if (!prepared.missingGlyphs) {
        prepared.paragraph.layout(resolveParagraphLayoutWidth(node))
        prepared.missingGlyphs = missingGlyphOccurrences(
          transformTextCase(node.text, node.textCase),
          prepared.paragraph.getShapedLines(),
          transformedSourceOffsets(node)
        )
      }
      return prepared.missingGlyphs
    }
  )
  if (missingOccurrences.length === 0) {
    r.textPreparationCache?.recordGlyphCoverage(node)
    return 'ready'
  }

  const charactersByScript = missingGlyphsByScript(missingOccurrences, (offset) =>
    languageForCharacter(node, offset)
  )

  let pending = false
  let exhausted = charactersByScript.size === 0
  for (const [script, characters] of charactersByScript) {
    if (demandRemoteCoverage(r, node, characters)) {
      pending = true
      continue
    }

    const demand = fontCoverageDemand(script, characters)
    const state = fontResolver.state(demand).state
    if (state === 'loaded') {
      fontResolver.exhaust(demand)
      exhausted = true
      continue
    }
    if (state === 'exhausted' || state === 'failed') {
      exhausted = true
      continue
    }
    pending = true
    if (state === 'idle') {
      r.trackFontDemand?.(node, demand.key)
      void fontResolver.demandForNode(demand, node.id, r.onFontResolutionSettled)
    }
  }
  if (pending) return 'pending'
  return exhausted ? 'exhausted' : 'ready'
}

function canObserveGlyphCoverage(r: FontReadinessRenderer): r is TextRenderer {
  return r.ck !== undefined && r.fontProvider != null && r.fontsLoaded !== undefined
}

export function nodeFontReadiness(r: FontReadinessRenderer, node: SceneNode): NodeFontReadiness {
  if (node.type !== 'TEXT') return 'ready'
  const faces = requiredFacesReadiness(r, node)
  if (faces === 'pending' || faces === 'exhausted') return faces
  if (!node.text || !canObserveGlyphCoverage(r)) return faces
  const glyphs = observedGlyphReadiness(r, node)
  // Substituted text still needs script fallbacks (for example CJK) for glyphs the substitute
  // lacks, but stays visible when none can be found.
  if (faces === 'substituted') return glyphs === 'pending' ? 'pending' : 'substituted'
  return glyphs
}

export function isNodeFontLoaded(r: FontReadinessRenderer, node: SceneNode): boolean {
  const readiness = nodeFontReadiness(r, node)
  return readiness === 'ready' || readiness === 'substituted'
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

function resolveParagraphLayoutWidth(node: ParagraphNode, maxWidth?: number): number {
  if (maxWidth !== undefined) return maxWidth
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 1e6
  return node.width || 1e6
}

function buildTruncateOpts(
  node: ParagraphNode,
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

/** Explicit axes win over the named-instance axes of a variable face (`implicit`). */
export function textFontVariations(
  variations: SceneNode['fontVariations'] | undefined,
  implicit: SceneNode['fontVariations'] | null = null
): TextFontVariations[] | undefined {
  const explicitAxes = new Set(variations?.map((variation) => variation.axis))
  const merged = [
    ...(implicit ?? []).filter((variation) => !explicitAxes.has(variation.axis)),
    ...(variations ?? [])
  ]
  if (merged.length === 0) return undefined
  return merged.map((variation) => ({ axis: variation.axis, value: variation.value }))
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

function styleRunLanguage(
  style: SceneNode['styleRuns'][number]['style'],
  node: Pick<ParagraphNode, 'textLanguage'>
): string | undefined {
  return style.textLanguage ?? node.textLanguage ?? undefined
}

function pushStyleRun(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: ParagraphNode,
  run: SceneNode['styleRuns'][number],
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, weight: number, italic?: boolean) => string[],
  halfLeading: boolean,
  paintStyle?: ParagraphPaintStyle
): void {
  const ck = r.ck
  const style = run.style
  const runLineHeight = style.lineHeight !== undefined ? style.lineHeight : node.lineHeight
  const runFontSize = style.fontSize ?? baseFontSize
  const runFamily = style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)
  const runWeight = style.fontWeight ?? node.fontWeight
  const runItalic = style.italic ?? node.italic

  const textStyle = new ck.TextStyle({
    color: styleRunColor(ck, style, baseColor),
    fontFamilies: fontFamilies(runFamily, runWeight, runItalic),
    fontSize: runFontSize,
    locale: styleRunLanguage(style, node),
    fontStyle: {
      weight: { value: runWeight } as FontWeight,
      slant: runItalic ? ck.FontSlant.Italic : ck.FontSlant.Upright
    },
    fontVariations: textFontVariations(
      style.fontVariations ?? node.fontVariations,
      fontManager.namedInstanceVariations(runFamily, weightToStyle(runWeight, runItalic))
    ),
    fontFeatures: textFontFeatures(style.fontFeatures ?? node.fontFeatures),
    letterSpacing: style.letterSpacing ?? (node.letterSpacing || 0),
    decoration: textDecorationValue(ck, style.textDecoration ?? node.textDecoration),
    decorationStyle: textDecorationStyleValue(
      ck,
      style.textDecorationStyle ?? node.textDecorationStyle
    ),
    decorationThickness: style.textDecorationThickness ?? node.textDecorationThickness ?? undefined,
    decorationColor: textDecorationColor(
      ck,
      style.textDecorationFills ?? node.textDecorationFills,
      baseColor
    ),
    heightMultiplier: runLineHeight ? runLineHeight / runFontSize : undefined,
    halfLeading
  })
  pushParagraphStyle(builder, textStyle, paintStyle)
}

function addParagraphText(
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: Pick<ParagraphNode, 'textCase'>,
  text: string
): void {
  builder.addText(transformTextCase(text, node.textCase))
}

function addStyledRuns(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: ParagraphNode,
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, weight: number, italic?: boolean) => string[],
  halfLeading: boolean,
  paintStyle?: ParagraphPaintStyle
): void {
  const text = node.text
  let pos = 0

  for (const run of node.styleRuns) {
    if (pos < run.start) addParagraphText(builder, node, text.slice(pos, run.start))
    pushStyleRun(
      r,
      builder,
      node,
      run,
      baseColor,
      baseFontSize,
      fontFamilies,
      halfLeading,
      paintStyle
    )
    addParagraphText(builder, node, text.slice(run.start, run.start + run.length))
    builder.pop()
    pos = run.start + run.length
  }

  if (pos < text.length) addParagraphText(builder, node, text.slice(pos))
}

export function buildParagraph(
  r: TextRenderer,
  node: ParagraphNode,
  color?: Float32Array,
  { halfLeading = false, foregroundPaint }: ParagraphBuildOptions = {}
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

  const baseTextStyle = {
    color: baseColor,
    fontFamilies: fontFamilies(
      node.fontFamily || DEFAULT_FONT_FAMILY,
      node.fontWeight,
      node.italic
    ),
    fontSize: baseFontSize,
    locale: node.textLanguage ?? undefined,
    fontStyle: {
      weight: { value: node.fontWeight } as FontWeight,
      slant: node.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
    },
    fontVariations: textFontVariations(
      node.fontVariations,
      fontManager.namedInstanceVariations(
        node.fontFamily || DEFAULT_FONT_FAMILY,
        weightToStyle(node.fontWeight, node.italic)
      )
    ),
    fontFeatures: textFontFeatures(node.fontFeatures),
    letterSpacing: node.letterSpacing || 0,
    decoration: textDecorationValue(ck, node.textDecoration),
    decorationStyle: textDecorationStyleValue(ck, node.textDecorationStyle),
    decorationThickness: node.textDecorationThickness ?? undefined,
    decorationColor: textDecorationColor(ck, node.textDecorationFills, baseColor),
    heightMultiplier: node.lineHeight ? node.lineHeight / baseFontSize : undefined,
    halfLeading
  }
  const paraStyle = new ck.ParagraphStyle({
    textAlign: getParagraphTextAlign(ck, node),
    textDirection: textDirection === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textHeightBehavior: textHeightBehaviorValue(ck, node.leadingTrim),
    ...truncateOpts,
    textStyle: baseTextStyle
  })

  if (!r.fontProvider) throw new Error('Font provider not initialized')
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, r.fontProvider)

  let background: Paint | undefined
  try {
    let paintStyle: ParagraphPaintStyle | undefined
    if (foregroundPaint) {
      background = new ck.Paint()
      background.setColor(ck.TRANSPARENT)
      paintStyle = { foreground: foregroundPaint, background }
      builder.pushPaintStyle(new ck.TextStyle(baseTextStyle), foregroundPaint, background)
    }
    if (node.styleRuns.length === 0) {
      addParagraphText(builder, node, node.text)
    } else {
      addStyledRuns(
        r,
        builder,
        node,
        baseColor,
        baseFontSize,
        fontFamilies,
        halfLeading,
        paintStyle
      )
    }

    const paragraph = builder.build()
    try {
      if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
        paragraph.layout(1e6)
        paragraph.layout(Math.max(node.width || 1, Math.ceil(paragraph.getLongestLine())))
      } else {
        paragraph.layout(resolveParagraphLayoutWidth(node))
      }
      return paragraph
    } catch (error) {
      paragraph.delete()
      throw error
    }
  } finally {
    builder.delete()
    background?.delete()
  }
}
