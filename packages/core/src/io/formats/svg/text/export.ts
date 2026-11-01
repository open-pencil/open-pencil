import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'
import { parseFontStyle } from '@open-pencil/scene-graph/font-style'
import { textLengthPixels } from '@open-pencil/scene-graph/text'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import {
  formatColor,
  type SVGExportContext,
  type SVGFontAlias,
  type SVGFontRequest
} from '#core/io/formats/svg/defs'
import { svg, type SVGNode } from '#core/io/formats/svg/node'
import { round } from '#core/io/formats/svg/paths'
import {
  explicitNewlineLines,
  laidOutTextSpans,
  textStyleSpans,
  type SpanAttrs,
  type SVGFallbackFace
} from '#core/io/formats/svg/text/lines'
import { shownText } from '#core/text/case'
import { drawnFontVariations } from '#core/text/font/families'
import { textFontFace } from '#core/text/requirements/collect'

function styleOverrideToTspanAttrs(
  style: CharacterStyleOverride,
  colorSpace: 'srgb' | 'display-p3',
  parentFillOpacity: number | undefined,
  node: Pick<SceneNode, 'fontSize' | 'letterSpacing'>
): Record<string, string | number | undefined> {
  const attrs: Record<string, string | number | undefined> = {}
  if (style.fontFamily) attrs['font-family'] = style.fontFamily
  if (style.fontSize) attrs['font-size'] = style.fontSize
  if (style.fontWeight) attrs['font-weight'] = style.fontWeight
  if (style.italic) attrs['font-style'] = 'italic'
  // A run's own spacing is written even at zero, or it would inherit the layer's. A percent the
  // run inherits follows its own font size, so a larger or smaller run writes it again.
  const inherited =
    style.fontSize !== undefined &&
    node.letterSpacing.unit === 'PERCENT' &&
    node.letterSpacing.value !== 0
      ? node.letterSpacing
      : undefined
  const spacing = style.letterSpacing ?? inherited
  if (spacing) {
    attrs['letter-spacing'] = round(textLengthPixels(spacing, style.fontSize ?? node.fontSize))
  }
  if (style.textDecoration === 'UNDERLINE') attrs['text-decoration'] = 'underline'
  if (style.textDecoration === 'STRIKETHROUGH') attrs['text-decoration'] = 'line-through'
  if (style.fills) {
    const visibleFill = style.fills.find((f) => f.visible && f.type === 'SOLID')
    if (visibleFill) {
      // Paragraphs and saved glyphs draw a run at color.a * opacity. Shapes paint opacity alone.
      const alpha = round(visibleFill.color.a * visibleFill.opacity)
      if (colorSpace === 'display-p3') {
        attrs.fill = formatColor({ ...visibleFill.color, a: 1 }, alpha, colorSpace)
      } else {
        attrs.fill = formatColor(visibleFill.color, 1, colorSpace)
        if (alpha < 1) attrs['fill-opacity'] = alpha
      }
      // `fill-opacity` inherits, so an opaque run has to cover a translucent parent.
      if (alpha >= 1 && parentFillOpacity !== undefined) attrs['fill-opacity'] = 1
    }
  }
  return attrs
}

/**
 * Font attributes naming a face's alias, such as the family a PDF embeds its file under, or else
 * the face itself, so text inside an aliased parent does not inherit the alias.
 */
function aliasedFontAttrs(
  face: SVGFontRequest,
  fontAlias: SVGFontAlias
): Record<string, string | number> {
  const alias = fontAlias(face)
  if (alias) return { 'font-family': alias, 'font-weight': 'normal', 'font-style': 'normal' }
  return {
    'font-family': face.family,
    'font-weight': face.weight,
    'font-style': face.italic ? 'italic' : 'normal'
  }
}

/**
 * The font attributes of a span: its face's alias where there is one, otherwise the family of the
 * fallback face that draws it, if any.
 */
function spanFontAttrs(
  node: SceneNode,
  style: CharacterStyleOverride,
  fallback: SVGFallbackFace | undefined,
  fontAlias: SVGFontAlias | undefined
): Record<string, string | number> {
  if (fontAlias) return aliasedFontAttrs(fontRequest(node, style, fallback), fontAlias)
  return fallback ? { 'font-family': fallback.family } : {}
}

/**
 * The face a run of `node` is drawn in, or the fallback face that draws its characters instead,
 * with the size and axes its instance follows. A fallback is drawn at the axes the run's own font
 * is drawn at, as the paragraph draws every font it falls back to.
 */
function fontRequest(
  node: SceneNode,
  style: CharacterStyleOverride = {},
  fallback?: SVGFallbackFace
): SVGFontRequest {
  const own: SVGFontRequest = {
    ...textFontFace(node, style),
    fontSize: style.fontSize ?? node.fontSize,
    variations: style.fontVariations ?? node.fontVariations,
    opticalSizeFromFontSize: style.opticalSizeFromFontSize ?? node.opticalSizeFromFontSize
  }
  if (!fallback) return own
  return {
    ...own,
    ...fallback,
    ...parseFontStyle(fallback.style),
    variations: drawnFontVariations(own),
    opticalSizeFromFontSize: false
  }
}

function isLogicalTextEnd(node: SceneNode, direction: 'LTR' | 'RTL'): boolean {
  return (
    (direction === 'LTR' && node.textAlignHorizontal === 'RIGHT') ||
    (direction === 'RTL' && node.textAlignHorizontal === 'LEFT')
  )
}

function textAnchorForNode(
  node: SceneNode,
  direction: 'LTR' | 'RTL'
): 'middle' | 'end' | undefined {
  if (node.textAlignHorizontal === 'CENTER') return 'middle'
  if (isLogicalTextEnd(node, direction)) return 'end'
  return undefined
}

function textXForNode(node: SceneNode, direction: 'LTR' | 'RTL'): number {
  if (node.textAlignHorizontal === 'CENTER') return round(node.width / 2)
  if (isLogicalTextEnd(node, direction)) return round(node.width)
  return 0
}

/** Text with no measured layout: explicit newlines on their own baselines, otherwise one line. */
function renderUnmeasuredText(
  node: SceneNode,
  attrs: Record<string, string | number | undefined>,
  spanAttrs: SpanAttrs,
  direction: 'LTR' | 'RTL'
): SVGNode {
  const x = textXForNode(node, direction)
  const y = node.fontSize || 14
  // No measured wraps: an explicit newline still starts a line, on the same anchor as one line.
  const newlineLines = explicitNewlineLines(node, x, y)
  if (newlineLines) {
    return svg(
      'text',
      { ...attrs, 'xml:space': 'preserve' },
      ...laidOutTextSpans(node, newlineLines, spanAttrs)
    )
  }

  if (node.styleRuns.length > 0) {
    return svg(
      'text',
      { x, y, ...attrs, 'xml:space': 'preserve' },
      ...textStyleSpans(node, spanAttrs)
    )
  }

  return svg('text', { x, y, ...attrs }, shownText(node))
}

export function renderTextNode(
  node: SceneNode,
  fillAttr: string | null,
  ctx: SVGExportContext,
  fillOpacity?: number
): SVGNode {
  const { colorSpace, textLayout, fontAlias } = ctx
  const direction = resolveNodeTextDirection(node)
  const lines = textLayout ? textLayout(node) : null
  const laidOut = lines && lines.length > 0 ? lines : null

  let textDecoration: 'underline' | 'line-through' | undefined
  if (node.textDecoration === 'UNDERLINE') textDecoration = 'underline'
  else if (node.textDecoration === 'STRIKETHROUGH') textDecoration = 'line-through'
  const letterSpacing = textLengthPixels(node.letterSpacing, node.fontSize)

  const attrs: Record<string, string | number | undefined> = {
    'font-family': node.fontFamily || undefined,
    'font-size': node.fontSize || undefined,
    'font-weight': node.fontWeight !== 400 ? node.fontWeight : undefined,
    'font-style': node.italic ? 'italic' : undefined,
    fill: fillAttr ?? undefined,
    'fill-opacity': fillOpacity,
    // Laid-out spans each start at their own left edge, so they take no direction or anchor.
    direction: direction === 'RTL' && !laidOut ? 'rtl' : undefined,
    'text-anchor': laidOut ? undefined : textAnchorForNode(node, direction),
    'text-decoration': textDecoration,
    'letter-spacing': letterSpacing ? round(letterSpacing) : undefined,
    ...(fontAlias ? aliasedFontAttrs(fontRequest(node), fontAlias) : {})
  }
  const spanAttrs = (style: CharacterStyleOverride, fallback?: SVGFallbackFace) => ({
    ...styleOverrideToTspanAttrs(style, colorSpace, fillOpacity, node),
    ...spanFontAttrs(node, style, fallback, fontAlias)
  })

  if (laidOut) {
    // Laid-out spans sit where the editor draws them, which keeps every space it draws.
    return svg(
      'text',
      { ...attrs, 'xml:space': 'preserve' },
      ...laidOutTextSpans(node, laidOut, spanAttrs)
    )
  }

  return renderUnmeasuredText(node, attrs, spanAttrs, direction)
}
