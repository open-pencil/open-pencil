import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import { mergedStyle, pickStyle } from './css-values'
import { elementDisplay } from './flow'

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

/**
 * Whether the element draws or sizes a box of its own, so it becomes a layer rather than text in
 * the text around it. Its display counts when it is not its tag's own.
 */
export function hasBoxStyle(element: DesignElement, style: DesignStyleDeclaration): boolean {
  const display = pickStyle(style, 'display')
  const shown = display?.replace(/!important/i, '').trim()
  if (shown !== undefined && shown !== elementDisplay(element, {})) return true
  return BOX_PROPERTIES.some((property) => {
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
