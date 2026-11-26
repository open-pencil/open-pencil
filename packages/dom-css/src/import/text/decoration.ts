import type { DesignElement, DesignStyleDeclaration } from '#dom-css/types'

import { decorates, DECORATION_PROPERTIES } from '.'
import { mergedStyle, pickStyle } from '../css-values'
import { elementDisplay } from '../flow'
import { isGrid } from '../grid'

/** Boxes CSS does not draw the decoration of what contains them through. */
function isolatesDecoration(
  element: DesignElement,
  style: DesignStyleDeclaration,
  around: DesignStyleDeclaration
): boolean {
  const position = pickStyle(style, 'position')
  if (position === 'absolute' || position === 'fixed') return true
  // A flex or grid item does not float.
  const float = pickStyle(style, 'float') ?? 'none'
  const display = pickStyle(around, 'display') ?? ''
  const laysOutItems = display === 'flex' || display === 'inline-flex' || isGrid(display)
  if (float !== 'none' && !laysOutItems) return true
  return elementDisplay(element, style).startsWith('inline-')
}

/**
 * An element's style, with the decoration CSS draws through it from the element around it when it
 * has none of its own, as an underlined link's flex items have.
 */
export function decoratedStyle(
  element: DesignElement,
  around: DesignStyleDeclaration
): DesignStyleDeclaration {
  const style = mergedStyle(element)
  if (!decorates(around) || decorates(style) || isolatesDecoration(element, style, around))
    return style
  const decoration = Object.entries(around).filter(([property]) =>
    DECORATION_PROPERTIES.has(property)
  )
  return { ...style, ...Object.fromEntries(decoration) }
}
