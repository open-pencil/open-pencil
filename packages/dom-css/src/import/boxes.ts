import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import { mergedStyle, pickStyle } from './css-values'
import { elementDisplay, type ParentFlow } from './flow'

/**
 * What each box property is set to when it draws or sizes nothing. A browser computes every
 * property, so a span with only text styling still has a transparent background and no padding;
 * only values that draw or size something make a box.
 */
const NO_BOX_VALUES: Record<string, readonly string[]> = {
  'aspect-ratio': ['auto'],
  background: ['none', 'transparent', 'rgba(0, 0, 0, 0)'],
  'background-color': ['transparent', 'rgba(0, 0, 0, 0)'],
  'border-style': ['none', 'hidden'],
  'border-top-style': ['none', 'hidden'],
  'border-right-style': ['none', 'hidden'],
  'border-bottom-style': ['none', 'hidden'],
  'border-left-style': ['none', 'hidden'],
  'box-shadow': ['none'],
  height: ['auto'],
  width: ['auto'],
  'min-width': ['auto'],
  'min-height': ['auto'],
  'max-width': ['none'],
  'max-height': ['none'],
  'object-fit': ['fill'],
  overflow: ['visible'],
  position: ['static'],
  top: ['auto'],
  right: ['auto'],
  bottom: ['auto'],
  left: ['auto'],
  'flex-wrap': ['nowrap'],
  'align-self': ['auto']
}

/** Properties that take no room when every part of their value is zero. */
const ZERO_LENGTH_PROPERTIES = new Set([
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-radius',
  'min-width',
  'min-height',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-block',
  'padding-inline'
])

/** Box properties a tag lays out with: a list's left padding is the gutter its markers sit in. */
const LIST_GUTTER = new Set(['padding-left', 'padding-inline-start'])
const TAG_LAYOUT_PROPERTIES = new Map<string, ReadonlySet<string>>([
  ['ul', LIST_GUTTER],
  ['ol', LIST_GUTTER]
])

/** Lengths that take no room: every part of the value is zero, in whatever unit. */
function isZeroLength(value: string): boolean {
  return value
    .trim()
    .split(/\s+/)
    .every((part) => /^[+-]?0*\.?0+([a-z]+|%)?$/.test(part))
}

const BOX_PROPERTIES = [...Object.keys(NO_BOX_VALUES), ...ZERO_LENGTH_PROPERTIES, 'border']

/** A `border` shorthand draws nothing without a style or with no width, in whatever order. */
function borderDraws(value: string): boolean {
  return !value
    .split(/\s+/)
    .some((part) => part === 'none' || part === 'hidden' || isZeroLength(part))
}

function drawsBox(property: string, value: string): boolean {
  const normalized = value
    .replace(/!important/i, '')
    .trim()
    .toLowerCase()
  if (property === 'border') return borderDraws(normalized)
  if (ZERO_LENGTH_PROPERTIES.has(property) && isZeroLength(normalized)) return false
  return !(NO_BOX_VALUES[property] ?? []).includes(normalized)
}

/** The display a flex item gets from its tag's own: an inline-level box becomes its block form. */
function blockified(display: string): string {
  if (display === 'inline' || display === 'inline-block') return 'block'
  return display.startsWith('inline-') ? display.slice('inline-'.length) : display
}

/**
 * Whether the element draws or sizes a box of its own, so it becomes a layer rather than text in
 * the text around it. Its display counts when it is not its tag's own, a flex item's display
 * being its tag's own once the flex container blockifies it, so an item that only shows text
 * stays text; the properties its tag lays out with, such as a list's gutter, do not count.
 */
export function hasBoxStyle(
  element: DesignElement,
  style: DesignStyleDeclaration,
  parentFlow: ParentFlow = 'block'
): boolean {
  const display = pickStyle(style, 'display')
  const shown = display?.replace(/!important/i, '').trim()
  const own = elementDisplay(element, {})
  const blockifies = parentFlow === 'flex' && shown === blockified(own)
  if (shown !== undefined && shown !== own && !blockifies) return true
  const layout = TAG_LAYOUT_PROPERTIES.get(element.tagName.toLowerCase())
  return BOX_PROPERTIES.some((property) => {
    if (layout?.has(property)) return false
    const value = pickStyle(style, property)
    return value !== undefined && drawsBox(property, value)
  })
}

/**
 * Whether any shown element of the document draws or sizes a box of its own, rather than only
 * styling text: what makes HTML worth laying out as layers instead of pasting as text. A hidden
 * element and what it holds become no layers, so they do not count.
 */
export function laysOutBoxes(document: DesignDocument): boolean {
  const visit = (nodes: readonly DesignNode[]): boolean =>
    nodes.some((node) => {
      if (node.type !== 'element') return false
      const style = mergedStyle(node)
      if (elementDisplay(node, style) === 'none') return false
      return hasBoxStyle(node, style) || visit(node.children)
    })
  return visit(document.children)
}
