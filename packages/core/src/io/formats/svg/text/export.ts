import type { CharacterStyleOverride, SceneNode } from '@open-pencil/scene-graph'
import { resolveNodeTextDirection } from '@open-pencil/scene-graph/text/direction'

import { formatColor, type SVGExportContext, type SVGFontAlias } from '#core/io/formats/svg/defs'
import { svg, type SVGNode } from '#core/io/formats/svg/node'
import { round } from '#core/io/formats/svg/paths'
import { laidOutTextSpans, textStyleSpans } from '#core/io/formats/svg/text/lines'
import { shownText } from '#core/text/case'
import type { FontFaceRef } from '#core/text/face'
import { textFontFace } from '#core/text/requirements'

function styleOverrideToTspanAttrs(
  style: CharacterStyleOverride,
  colorSpace: 'srgb' | 'display-p3'
): Record<string, string | number | undefined> {
  const attrs: Record<string, string | number | undefined> = {}
  if (style.fontFamily) attrs['font-family'] = style.fontFamily
  if (style.fontSize) attrs['font-size'] = style.fontSize
  if (style.fontWeight) attrs['font-weight'] = style.fontWeight
  if (style.italic) attrs['font-style'] = 'italic'
  if (style.letterSpacing) attrs['letter-spacing'] = round(style.letterSpacing)
  if (style.textDecoration === 'UNDERLINE') attrs['text-decoration'] = 'underline'
  if (style.textDecoration === 'STRIKETHROUGH') attrs['text-decoration'] = 'line-through'
  if (style.fills) {
    const visibleFill = style.fills.find((f) => f.visible && f.type === 'SOLID')
    if (visibleFill) {
      attrs.fill = formatColor(visibleFill.color, visibleFill.opacity, colorSpace)
    }
  }
  return attrs
}

/**
 * Font attributes naming a face's alias, such as the family a PDF embeds its file under, or else
 * the face itself, so text inside an aliased parent does not inherit the alias.
 */
function aliasedFontAttrs(
  face: FontFaceRef,
  fontAlias: SVGFontAlias
): Record<string, string | number> {
  const alias = fontAlias(face.family, face.style)
  if (alias) return { 'font-family': alias, 'font-weight': 'normal', 'font-style': 'normal' }
  return {
    'font-family': face.family,
    'font-weight': face.weight,
    'font-style': face.italic ? 'italic' : 'normal'
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

export function renderTextNode(
  node: SceneNode,
  fillAttr: string | null,
  ctx: SVGExportContext
): SVGNode {
  const { colorSpace, textLayout, fontAlias } = ctx
  const direction = resolveNodeTextDirection(node)
  const lines = textLayout ? textLayout(node) : null
  const laidOut = lines && lines.length > 0 ? lines : null

  let textDecoration: 'underline' | 'line-through' | undefined
  if (node.textDecoration === 'UNDERLINE') textDecoration = 'underline'
  else if (node.textDecoration === 'STRIKETHROUGH') textDecoration = 'line-through'

  const attrs: Record<string, string | number | undefined> = {
    'font-family': node.fontFamily || undefined,
    'font-size': node.fontSize || undefined,
    'font-weight': node.fontWeight !== 400 ? node.fontWeight : undefined,
    'font-style': node.italic ? 'italic' : undefined,
    fill: fillAttr ?? undefined,
    // Laid-out spans each start at their own left edge, so they take no direction or anchor.
    direction: direction === 'RTL' && !laidOut ? 'rtl' : undefined,
    'text-anchor': laidOut ? undefined : textAnchorForNode(node, direction),
    'text-decoration': textDecoration,
    'letter-spacing': node.letterSpacing ? round(node.letterSpacing) : undefined,
    ...(fontAlias ? aliasedFontAttrs(textFontFace(node), fontAlias) : {})
  }
  const spanAttrs = (style: CharacterStyleOverride) => ({
    ...styleOverrideToTspanAttrs(style, colorSpace),
    ...(fontAlias ? aliasedFontAttrs(textFontFace(node, style), fontAlias) : {})
  })

  if (laidOut) {
    // Laid-out spans sit where the editor draws them, which keeps every space it draws.
    return svg(
      'text',
      { ...attrs, 'xml:space': 'preserve' },
      ...laidOutTextSpans(node, laidOut, spanAttrs)
    )
  }

  const x = textXForNode(node, direction)
  const y = node.fontSize || 14

  if (node.styleRuns.length > 0) {
    return svg(
      'text',
      { x, y, ...attrs, 'xml:space': 'preserve' },
      ...textStyleSpans(node, spanAttrs)
    )
  }

  return svg('text', { x, y, ...attrs }, shownText(node))
}
