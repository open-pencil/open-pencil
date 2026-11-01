import type {
  CanvasKit,
  FontStyle,
  Paint,
  Paragraph,
  ParagraphBuilder,
  TextFontFeatures,
  TextFontVariations,
  TextHeightBehavior
} from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { resolveRGBAForPreview } from '@open-pencil/scene-graph/color'
import { faceStyleKey, type NamedFace } from '@open-pencil/scene-graph/font-style'
import { rangeFontStyle } from '@open-pencil/scene-graph/shared-styles'
import { lineHeightPixels, textLengthPixels } from '@open-pencil/scene-graph/text'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import {
  pushParagraphStyle,
  type ParagraphPaintStyle,
  type ParagraphBuildOptions
} from '#core/canvas/text/paint'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { shownTextSlice } from '#core/text/case'
import { ELLIPSIS } from '#core/text/ellipsis'
import {
  drawnFontVariations,
  loadedFace,
  resolveParagraphFontFamilies
} from '#core/text/font/families'
import { fontManager } from '#core/text/font/manager'
import { laidOutText } from '#core/text/keycap'

import type { ParagraphNode } from './inputs'

export function resolveParagraphLayoutWidth(node: ParagraphNode, maxWidth?: number): number {
  if (maxWidth !== undefined) return maxWidth
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 1e6
  return node.width || 1e6
}

export function buildTruncateOpts(node: ParagraphNode): { maxLines?: number; ellipsis?: string } {
  if (node.textTruncation !== 'ENDING') return {}

  const opts: { maxLines?: number; ellipsis: string } = { ellipsis: ELLIPSIS }
  if (node.maxLines != null && node.maxLines > 0) {
    opts.maxLines = node.maxLines
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

export function textHeightBehaviorValue<T>(
  ck: { TextHeightBehavior: { DisableAll: T } },
  leadingTrim: SceneNode['leadingTrim']
): T | undefined {
  return leadingTrim === 'CAP_HEIGHT' ? ck.TextHeightBehavior.DisableAll : undefined
}

/** Which edges of the text a paragraph is: leading trim only trims the text's own edges. */
export interface ParagraphEdges {
  first: boolean
  last: boolean
}

function blockHeightBehavior(
  ck: CanvasKit,
  leadingTrim: SceneNode['leadingTrim'],
  edges: ParagraphEdges | undefined
): TextHeightBehavior | undefined {
  if (!edges) return textHeightBehaviorValue(ck, leadingTrim)
  const { first, last } = edges
  if (leadingTrim !== 'CAP_HEIGHT') return undefined
  if (first && last) return ck.TextHeightBehavior.DisableAll
  if (first) return ck.TextHeightBehavior.DisableFirstAscent
  if (last) return ck.TextHeightBehavior.DisableLastDescent
  return ck.TextHeightBehavior.All
}

/**
 * The style a paragraph asks CanvasKit for: the face of the family that is loaded. Asked for a
 * face it lacks, CanvasKit slants and emboldens another, which neither Figma, a browser, nor a
 * native text stack draws the same, so a missing face is drawn as the face that exists and
 * reported missing, as Figma does. A family with no face loaded asks for the style as given.
 */
function drawnFontStyle(
  ck: CanvasKit,
  family: string,
  weight: number,
  italic: boolean,
  style: string
): FontStyle {
  const face = loadedFace(family, weight, italic, style) ?? { weight, italic }
  return {
    weight: { value: face.weight },
    slant: face.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
  }
}

/** The colour a style run's text is drawn in: its first visible solid fill, or `baseColor`. */
export function styleRunColor(
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
  return (style.textLanguage !== undefined ? style.textLanguage : node.textLanguage) ?? undefined
}

function pushStyleRun(
  r: TextRenderer,
  builder: ParagraphBuilder,
  node: ParagraphNode,
  run: SceneNode['styleRuns'][number],
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, face: NamedFace) => string[],
  halfLeading: boolean,
  paintStyle?: ParagraphPaintStyle
): void {
  const ck = r.ck
  const style = run.style
  const runFontSize = style.fontSize ?? baseFontSize
  // A percent follows the run's own font size, as in Figma.
  const runLineHeight = lineHeightPixels(
    style.lineHeight !== undefined ? style.lineHeight : node.lineHeight,
    runFontSize
  )
  const runFamily = style.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)
  const runWeight = style.fontWeight ?? node.fontWeight
  const runItalic = style.italic ?? node.italic
  const runFace = {
    fontWeight: runWeight,
    italic: runItalic,
    fontStyle: rangeFontStyle(node, style)
  }
  const runKey = faceStyleKey(runFace)

  const textStyle = new ck.TextStyle({
    color: styleRunColor(ck, style, baseColor),
    fontFamilies: fontFamilies(runFamily, runFace),
    fontSize: runFontSize,
    locale: styleRunLanguage(style, node),
    fontStyle: drawnFontStyle(ck, runFamily, runWeight, runItalic, runKey),
    fontVariations: textFontVariations(
      drawnFontVariations({
        family: runFamily,
        weight: runWeight,
        italic: runItalic,
        style: runKey,
        fontSize: runFontSize,
        variations: style.fontVariations ?? node.fontVariations,
        opticalSizeFromFontSize: style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
      })
    ),
    fontFeatures: textFontFeatures(style.fontFeatures ?? node.fontFeatures),
    letterSpacing: textLengthPixels(style.letterSpacing ?? node.letterSpacing, runFontSize),
    heightMultiplier: runLineHeight ? runLineHeight / runFontSize : undefined,
    halfLeading
  })
  pushParagraphStyle(builder, textStyle, paintStyle)
}

/** `text[start, end)` in the case each of its characters has. */
function addParagraphText(
  builder: ParagraphBuilder,
  node: ParagraphNode,
  start: number,
  end: number
): void {
  builder.addText(laidOutText(shownTextSlice(node, start, end)))
}

function addStyledRuns(
  r: TextRenderer,
  builder: ParagraphBuilder,
  node: ParagraphNode,
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string, face: NamedFace) => string[],
  halfLeading: boolean,
  paintStyle?: ParagraphPaintStyle
): void {
  const text = node.text
  let pos = 0

  for (const run of node.styleRuns) {
    if (pos < run.start) addParagraphText(builder, node, pos, run.start)
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
    addParagraphText(builder, node, run.start, run.start + run.length)
    builder.pop()
    pos = run.start + run.length
  }

  if (pos < text.length) addParagraphText(builder, node, pos, text.length)
}

/** What a paragraph that is one block of a longer text needs beyond its node's own style. */
export interface ParagraphBlockOptions {
  /** Room before the first line, as a plain paragraph's first-line indent. */
  firstLineIndent?: number
  /** Truncation for this block in place of the node's. */
  truncation?: { maxLines?: number; ellipsis?: string }
  edges?: ParagraphEdges
}

/** Room before a paragraph's first line, as an empty placeholder on its baseline. */
function addFirstLineIndent(ck: CanvasKit, builder: ParagraphBuilder, width: number): void {
  builder.addPlaceholder(width, 0, ck.PlaceholderAlignment.Baseline, ck.TextBaseline.Alphabetic, 0)
}

/**
 * A native paragraph for `node`'s text in its style runs, not yet laid out. A first-line
 * indent is a placeholder before the text, which takes the first character index.
 */
export function buildSkParagraph(
  r: TextRenderer,
  node: ParagraphNode,
  color?: Float32Array,
  { halfLeading = false, foregroundPaint }: ParagraphBuildOptions = {},
  block: ParagraphBlockOptions = {}
): Paragraph {
  const ck = r.ck
  const baseColor = color ?? ck.BLACK
  const baseFontSize = node.fontSize || DEFAULT_FONT_SIZE
  const baseLineHeight = lineHeightPixels(node.lineHeight, baseFontSize)
  const cjkFallbacks = fontManager.getCJKFallbackFamilies()
  const arabicFallbacks = fontManager.getArabicFallbackFamilies()
  const textDirection = resolveNodeTextDirection(node)

  const truncateOpts = block.truncation ?? buildTruncateOpts(node)

  const fontFamilies = (primary: string, face: NamedFace) =>
    resolveParagraphFontFamilies(
      primary,
      { weight: face.fontWeight, italic: face.italic, style: faceStyleKey(face) },
      arabicFallbacks,
      cjkFallbacks
    )
  const nodeKey = faceStyleKey(node)

  const baseTextStyle = {
    color: baseColor,
    fontFamilies: fontFamilies(node.fontFamily || DEFAULT_FONT_FAMILY, node),
    fontSize: baseFontSize,
    locale: node.textLanguage ?? undefined,
    fontStyle: drawnFontStyle(
      ck,
      node.fontFamily || DEFAULT_FONT_FAMILY,
      node.fontWeight,
      node.italic,
      nodeKey
    ),
    fontVariations: textFontVariations(
      drawnFontVariations({
        family: node.fontFamily || DEFAULT_FONT_FAMILY,
        weight: node.fontWeight,
        italic: node.italic,
        style: nodeKey,
        fontSize: baseFontSize,
        variations: node.fontVariations,
        opticalSizeFromFontSize: node.opticalSizeFromFontSize
      })
    ),
    fontFeatures: textFontFeatures(node.fontFeatures),
    letterSpacing: textLengthPixels(node.letterSpacing, baseFontSize),
    heightMultiplier: baseLineHeight ? baseLineHeight / baseFontSize : undefined,
    halfLeading
  }
  const paraStyle = new ck.ParagraphStyle({
    textAlign: getParagraphTextAlign(ck, node),
    textDirection: textDirection === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textHeightBehavior: blockHeightBehavior(ck, node.leadingTrim, block.edges),
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
    if (block.firstLineIndent) addFirstLineIndent(ck, builder, block.firstLineIndent)
    if (node.styleRuns.length === 0) {
      addParagraphText(builder, node, 0, node.text.length)
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

    return builder.build()
  } finally {
    builder.delete()
    background?.delete()
  }
}
