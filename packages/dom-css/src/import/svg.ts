import type { SceneNode } from '@open-pencil/scene-graph'
import { parseCSSAspectRatio, parseCSSNumber, splitCSSValue } from '@open-pencil/scene-graph/css'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'

/** Whether an element is inline SVG, which draws artwork rather than holding layers. */
export function isInlineSVG(element: DesignElement): boolean {
  return element.tagName.toLowerCase() === 'svg'
}

/** An attribute the element may not have, by any of its spellings. */
function attribute(element: DesignElement, ...names: string[]): string | undefined {
  const name = names.find((candidate) => Object.hasOwn(element.attrs, candidate))
  return name === undefined ? undefined : element.attrs[name]
}

/** The width over height of an SVG's `viewBox`, or null without a usable one. */
function viewBoxRatio(element: DesignElement): number | null {
  const value = attribute(element, 'viewBox', 'viewbox') ?? ''
  const [, , width, height] = splitCSSValue(value.replaceAll(',', ' ')).map(Number)
  return width > 0 && height > 0 ? width / height : null
}

/** A CSS replaced element's size when nothing sizes it, as a browser gives inline SVG. */
const DEFAULT_SVG_SIZE = { width: 300, height: 150 }

/**
 * Sizes inline SVG as CSS sizes a replaced element: each side takes its style's size, else its
 * `width` or `height` attribute; a side still unsized follows the other by the box's
 * `aspect-ratio`, else the `viewBox` ratio, the SVG's own; one with nothing to follow takes the
 * default of 300 by 150.
 */
export function applySVGSize(
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  const sized = (name: 'width' | 'height') =>
    parseCSSNumber(pickStyle(style, name)) ?? parseCSSNumber(attribute(element, name))
  const width = sized('width')
  const height = sized('height')
  const aspect = parseCSSAspectRatio(pickStyle(style, 'aspect-ratio'))
  const ratio = aspect && !aspect.auto ? aspect.ratio : viewBoxRatio(element)
  if (width !== null) node.width = width
  if (height !== null) node.height = height
  if (width === null) {
    node.width = height !== null && ratio !== null ? height * ratio : DEFAULT_SVG_SIZE.width
  }
  if (height === null) {
    node.height = width !== null && ratio !== null ? width / ratio : DEFAULT_SVG_SIZE.height
  }
}
