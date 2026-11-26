import type { SceneNode } from '@open-pencil/scene-graph'
import { parseCSSAspectRatio, parseCSSNumber } from '@open-pencil/scene-graph/css'
import { parseSVGViewBoxValue } from '@open-pencil/scene-graph/parse-path'

import type { DesignElement, DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'

/** Whether an element is inline SVG, which draws artwork rather than holding layers. */
export function isInlineSVG(element: DesignElement): boolean {
  return element.tagName.toLowerCase() === 'svg'
}

/** The width over height of an SVG's `viewBox`, or null without a usable one. */
function viewBoxRatio(element: DesignElement): number | null {
  const attrs: Partial<Record<string, string>> = element.attrs
  const viewBox = parseSVGViewBoxValue(attrs.viewBox ?? attrs.viewbox)
  return viewBox ? viewBox.width / viewBox.height : null
}

/** A CSS replaced element's size when nothing sizes it, as a browser gives inline SVG. */
const DEFAULT_SVG_SIZE = { width: 300, height: 150 }

/**
 * Sizes inline SVG as CSS sizes a replaced element: each side takes its style's size, `auto`
 * included, else its `width` or `height` attribute; a side still unsized follows the other by the box's
 * `aspect-ratio`, else the `viewBox` ratio, the SVG's own; one with nothing to follow takes the
 * default of 300 by 150.
 */
export function applySVGSize(
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  const attrs: Partial<Record<string, string>> = element.attrs
  // A size the style gives, `auto` included, overrides the attribute, which counts only without it.
  const sized = (name: 'width' | 'height') => {
    const value = pickStyle(style, name)
    return parseCSSNumber(value === undefined ? attrs[name] : value)
  }
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
