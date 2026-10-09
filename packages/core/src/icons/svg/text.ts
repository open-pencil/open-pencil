import type { Element, Node } from '@xmldom/xmldom'

import type { SVGTextInfo, SVGTextPiece, SVGTextRun } from '#core/icons/types'

import {
  isElement,
  normalizeSVGPaint,
  num,
  opacityValue,
  presentationFor,
  type PresentationAttributes
} from './presentation'
import type { Scope } from './scope'

/** Figma draws SVG text without a size at 12px. */
const DEFAULT_FONT_SIZE = 12
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace'
])
/**
 * Attributes that start a new layer. A `dx` alone shifts from where the text so far ends, which
 * only layout knows, so such a `<tspan>` stays in its layer as a style run.
 */
const MOVES = ['x', 'y', 'dy']

function fontFamily(value: string): string | null {
  for (const entry of value.split(',')) {
    const family = entry.trim().replace(/^['"]|['"]$/g, '')
    if (family && !GENERIC_FAMILIES.has(family.toLowerCase())) return family
  }
  return null
}

function fontWeight(value: string): number {
  const keyword = value.trim().toLowerCase()
  if (keyword === 'bold' || keyword === 'bolder') return 700
  if (keyword === 'lighter') return 300
  const parsed = Number.parseFloat(keyword)
  return Number.isFinite(parsed) ? parsed : 400
}

function textDecoration(value: string): SVGTextRun['textDecoration'] {
  const decoration = value.toLowerCase()
  if (decoration.includes('underline')) return 'UNDERLINE'
  if (decoration.includes('line-through')) return 'STRIKETHROUGH'
  return 'NONE'
}

function textRun(text: string, presentation: PresentationAttributes): SVGTextRun {
  const size = Number.parseFloat(presentation.fontSize)
  const spacing = Number.parseFloat(presentation.letterSpacing)
  return {
    text,
    fill: normalizeSVGPaint(presentation.fill),
    fillOpacity: opacityValue(presentation.fillOpacity),
    fontFamily: fontFamily(presentation.fontFamily),
    fontSize: Number.isFinite(size) && size > 0 ? size : DEFAULT_FONT_SIZE,
    fontWeight: fontWeight(presentation.fontWeight),
    italic: /italic|oblique/i.test(presentation.fontStyle),
    letterSpacing: Number.isFinite(spacing) ? spacing : 0,
    textDecoration: textDecoration(presentation.textDecoration)
  }
}

function anchor(presentation: PresentationAttributes): SVGTextPiece['anchor'] {
  const value = presentation.textAnchor.trim()
  return value === 'middle' || value === 'end' ? value : 'start'
}

/** Collapse whitespace as SVG does by default: runs of it become one space, trimmed at the ends. */
function collapseWhitespace(piece: SVGTextPiece): SVGTextPiece {
  let afterSpace = true
  const runs = piece.runs.map((run) => {
    let text = run.text.replace(/\s+/g, ' ')
    if (afterSpace) text = text.replace(/^ /, '')
    if (text) afterSpace = text.endsWith(' ')
    return { ...run, text }
  })
  const last = runs.findLastIndex((run) => run.text)
  if (last !== -1) runs[last] = { ...runs[last], text: runs[last].text.replace(/ $/, '') }
  return { ...piece, runs: runs.filter((run) => run.text) }
}

/** The pieces of a `<text>` element, split where a `<tspan>` moves the text position. */
export function collectTextPieces(element: Element, scope: Scope): SVGTextPiece[] {
  const pieces: SVGTextPiece[] = []
  let current: SVGTextPiece = {
    x: num(element, 'x'),
    y: num(element, 'y'),
    anchor: anchor(scope.presentation),
    runs: []
  }
  const walk = (node: Node, presentation: PresentationAttributes) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === child.TEXT_NODE || child.nodeType === child.CDATA_SECTION_NODE) {
        current.runs.push(textRun(child.nodeValue ?? '', presentation))
        continue
      }
      if (!isElement(child) || (child.localName || child.tagName) !== 'tspan') continue
      const style = presentationFor(child, presentation)
      if (MOVES.some((name) => child.hasAttribute(name))) {
        pieces.push(current)
        current = {
          x: child.hasAttribute('x') ? num(child, 'x') : current.x + num(child, 'dx'),
          y: child.hasAttribute('y') ? num(child, 'y') : current.y + num(child, 'dy'),
          anchor: anchor(style),
          runs: []
        }
      }
      walk(child, style)
    }
  }
  walk(element, scope.presentation)
  pieces.push(current)
  return pieces.map(collapseWhitespace).filter((piece) => piece.runs.length > 0)
}

export function textInfo(
  element: Element,
  scope: Scope,
  pathIndex: number
): Omit<SVGTextInfo, 'elements'> | null {
  const pieces = collectTextPieces(element, scope)
  if (pieces.length === 0) return null
  return {
    pieces,
    transform: scope.transform,
    clipPaths: scope.clipPaths.length > 0 ? scope.clipPaths : undefined,
    pathIndex
  }
}
