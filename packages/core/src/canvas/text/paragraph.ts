import type {
  CanvasKit,
  FontWeight,
  Paint,
  Paragraph,
  ParagraphBuilder,
  TextFontFeatures,
  TextFontVariations,
  TextHeightBehavior
} from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { resolveRGBAForPreview } from '@open-pencil/scene-graph/color'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text-direction'

import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_SIZE } from '#core/constants'
import { transformTextCase } from '#core/text/case'
import { fontManager, weightToStyle } from '#core/text/fonts'

import { resolveParagraphFontFamilies } from './font-families'
import { pushParagraphStyle, type ParagraphPaintStyle, type ParagraphBuildOptions } from './paint'
import type { ParagraphNode } from './paragraph-inputs'
import type { TextRenderer } from './renderer'

export function resolveParagraphLayoutWidth(node: ParagraphNode, maxWidth?: number): number {
  if (maxWidth !== undefined) return maxWidth
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 1e6
  return node.width || 1e6
}

export function buildTruncateOpts(
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
  builder: ParagraphBuilder,
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
  builder: ParagraphBuilder,
  node: Pick<ParagraphNode, 'textCase'>,
  text: string
): void {
  builder.addText(transformTextCase(text, node.textCase))
}

function addStyledRuns(
  r: TextRenderer,
  builder: ParagraphBuilder,
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
  const cjkFallbacks = fontManager.getCJKFallbackFamilies()
  const arabicFallbacks = fontManager.getArabicFallbackFamilies()
  const textDirection = resolveNodeTextDirection(node)

  const truncateOpts = block.truncation ?? buildTruncateOpts(node, baseFontSize)

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

    return builder.build()
  } finally {
    builder.delete()
    background?.delete()
  }
}
