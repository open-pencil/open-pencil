import type { DesignElement, DesignStyleDeclaration } from '../types'
import { mergedStyle, pickStyle } from './css-values'
import { elementDisplay } from './flow'
import { decorates, DECORATION_PROPERTIES } from './text'

/** Boxes CSS does not draw the decoration of what contains them through. */
function isolatesDecoration(element: DesignElement, style: DesignStyleDeclaration): boolean {
  const position = pickStyle(style, 'position')
  if (position === 'absolute' || position === 'fixed') return true
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
  if (!decorates(around) || decorates(style) || isolatesDecoration(element, style)) return style
  const decoration = Object.entries(around).filter(([property]) =>
    DECORATION_PROPERTIES.has(property)
  )
  return { ...style, ...Object.fromEntries(decoration) }
}
