import type {
  CanvasKit,
  FontStyle,
  Paint,
  Paragraph,
  ParagraphBuilder,
  TextFontFeatures,
  TextFontVariations,
  TextStyle
} from '@open-pencil/canvaskit'
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
import { JOINER, type Joiner } from '#core/canvas/text/paragraph/joiners'
import { styledRanges } from '#core/canvas/text/paragraph/runs'
import type { TextRenderer } from '#core/canvas/text/renderer'
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { autoWidthWrapWidth } from '#core/layout/text-measurement'
import { shownTextSlice } from '#core/text/case'
import { ELLIPSIS } from '#core/text/ellipsis'
import { makeParagraphBuilder } from '#core/text/font/collection'
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
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') {
    return autoWidthWrapWidth(node) ?? 1e6
  }
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

export type ParagraphTextAlign = 'Left' | 'Right' | 'Center' | 'Justify'

export function paragraphTextAlign(
  node: Pick<SceneNode, 'textAlignHorizontal' | 'textDirection' | 'text'>
): ParagraphTextAlign {
  const direction = resolveNodeTextDirection(node)
  switch (node.textAlignHorizontal) {
    case 'CENTER':
      return 'Center'
    case 'RIGHT':
      return direction === 'RTL' ? 'Left' : 'Right'
    case 'JUSTIFIED':
      return 'Justify'
    default:
      return direction === 'RTL' ? 'Right' : 'Left'
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
): TextStyle {
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
  return textStyle
}

type AddText = (start: number, end: number, style: TextStyle) => void

/** `text[start, end)` in the case each of its characters has. */
function addParagraphText(
  builder: ParagraphBuilder,
  node: ParagraphNode,
  start: number,
  end: number
): void {
  builder.addText(laidOutText(shownTextSlice(node, start, end)))
}

function joinedTextAdder(
  ck: CanvasKit,
  builder: ParagraphBuilder,
  node: ParagraphNode,
  joiners: readonly Joiner[],
  paintStyle: ParagraphPaintStyle | undefined
): AddText {
  let next = 0
  return (start, end, style) => {
    while (next < joiners.length && joiners[next].at <= start) {
      next++
    }
    let from = start
    for (; next < joiners.length && joiners[next].at <= end; next++) {
      const joiner = joiners[next]
      addParagraphText(builder, node, from, joiner.at)
      const joinerStyle = new ck.TextStyle({ ...style, letterSpacing: -joiner.spacing })
      pushParagraphStyle(builder, joinerStyle, paintStyle)
      builder.addText(JOINER)
      builder.pop()
      from = joiner.at
    }
    addParagraphText(builder, node, from, end)
  }
}

function addStyledRuns(
  r: TextRenderer,
  builder: ParagraphBuilder,
  node: ParagraphNode,
  base: { color: Float32Array; fontSize: number; style: TextStyle },
  fontFamilies: (primary: string, face: NamedFace) => string[],
  halfLeading: boolean,
  addText: AddText,
  paintStyle?: ParagraphPaintStyle
): void {
  const text = node.text
  let pos = 0

  for (const { start, end, run } of styledRanges(text, node.styleRuns)) {
    if (pos < start) {
      addText(pos, start, base.style)
    }
    const style = pushStyleRun(
      r,
      builder,
      node,
      run,
      base.color,
      base.fontSize,
      fontFamilies,
      halfLeading,
      paintStyle
    )
    addText(start, end, style)
    builder.pop()
    pos = end
  }

  if (pos < text.length) {
    addText(pos, text.length, base.style)
  }
}

/** What a paragraph that is one block of a longer text needs beyond its node's own style. */
export interface ParagraphBlockOptions {
  /** Room before the first line, as a plain paragraph's first-line indent. */
  firstLineIndent?: number
  /** Truncation for this block in place of the node's. */
  truncation?: { maxLines?: number; ellipsis?: string }
  joiners?: readonly Joiner[]
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
    textAlign: ck.TextAlign[paragraphTextAlign(node)],
    textDirection: textDirection === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    ...truncateOpts,
    textStyle: baseTextStyle,
    // Skia otherwise rounds each line's width up to a whole pixel before fitting it in the box.
    applyRoundingHack: false
  })

  if (!r.fontProvider) throw new Error('Font provider not initialized')
  const builder = makeParagraphBuilder(ck, paraStyle, r.fontProvider)

  const baseStyle = new ck.TextStyle(baseTextStyle)
  let background: Paint | undefined
  try {
    let paintStyle: ParagraphPaintStyle | undefined
    if (foregroundPaint) {
      background = new ck.Paint()
      background.setColor(ck.TRANSPARENT)
      paintStyle = { foreground: foregroundPaint, background }
      builder.pushPaintStyle(baseStyle, foregroundPaint, background)
    }
    if (block.firstLineIndent) addFirstLineIndent(ck, builder, block.firstLineIndent)
    const addText = joinedTextAdder(ck, builder, node, block.joiners ?? [], paintStyle)
    if (node.styleRuns.length === 0) {
      addText(0, node.text.length, baseStyle)
    } else {
      addStyledRuns(
        r,
        builder,
        node,
        { color: baseColor, fontSize: baseFontSize, style: baseStyle },
        fontFamilies,
        halfLeading,
        addText,
        paintStyle
      )
    }

    return builder.build()
  } finally {
    builder.delete()
    background?.delete()
  }
}
