import type { SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber, splitCSSValue } from '@open-pencil/scene-graph/css'

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
 * Sizes inline SVG as CSS sizes a replaced element: a side its style leaves `auto` follows the
 * other by the `viewBox` ratio, else takes its `width` or `height` attribute, else the default
 * 300 by 150. Sizes its style gives are set already.
 */
export function applySVGSize(
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  const width = parseCSSNumber(pickStyle(style, 'width'))
  const height = parseCSSNumber(pickStyle(style, 'height'))
  const ratio = viewBoxRatio(element)
  const sized = (name: 'width' | 'height') => parseCSSNumber(attribute(element, name))
  if (width === null) {
    node.width =
      height !== null && ratio !== null
        ? height * ratio
        : (sized('width') ?? DEFAULT_SVG_SIZE.width)
  }
  if (height === null) {
    node.height =
      width !== null && ratio !== null
        ? width / ratio
        : (sized('height') ?? DEFAULT_SVG_SIZE.height)
  }
}
