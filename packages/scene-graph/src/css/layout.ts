import valueParser from 'postcss-value-parser'

import {
  parseAutoLayoutDirection,
  parseCounterAxisAlign,
  parseLayoutAlignSelf,
  parsePrimaryAxisAlign,
  type AutoLayoutDirection
} from '../layout/keywords'
import type { LayoutAlign, LayoutAlignSelf, LayoutCounterAlign } from '../types'

/**
 * The one alignment keyword a CSS box alignment value names, or `undefined` when it names
 * something auto layout cannot express. An overflow position (`safe center`) is dropped, and
 * `first baseline` is the baseline auto layout aligns to.
 */
function alignmentKeyword(value: string | undefined): string | undefined {
  if (!value) return undefined
  const nodes = valueParser(value).nodes.filter((node) => node.type !== 'space')
  if (nodes.some((node) => node.type !== 'word')) return undefined
  const words = nodes.map((node) => node.value.toLowerCase())
  if (words[0] === 'safe' || words[0] === 'unsafe') words.shift()
  if (words[0] === 'first' && words[1] === 'baseline') words.shift()
  return words.length === 1 ? words[0] : undefined
}

/** A stack direction from `flex-direction`; the reversed directions have no auto layout. */
export function parseCSSFlexDirection(value: string | undefined): AutoLayoutDirection | undefined {
  const keyword = alignmentKeyword(value)
  return keyword === 'row' || keyword === 'column' ? parseAutoLayoutDirection(keyword) : undefined
}

/**
 * Primary axis alignment from `justify-content`; `normal` packs flex items at the start. Design
 * JSX's `between` is not CSS, which browsers ignore, so it is not read here.
 */
export function parseCSSJustifyContent(value: string | undefined): LayoutAlign | undefined {
  const keyword = alignmentKeyword(value)
  if (keyword === 'between') return undefined
  return keyword === 'normal' ? 'MIN' : parsePrimaryAxisAlign(keyword)
}

/** Cross axis alignment from `align-items`; `normal` stretches flex items. */
export function parseCSSAlignItems(value: string | undefined): LayoutCounterAlign | undefined {
  const keyword = alignmentKeyword(value)
  return keyword === 'normal' ? 'STRETCH' : parseCounterAxisAlign(keyword)
}

/** One flex item's cross axis alignment from `align-self`; `normal` stretches it. */
export function parseCSSAlignSelf(value: string | undefined): LayoutAlignSelf | undefined {
  const keyword = alignmentKeyword(value)
  return keyword === 'normal' ? 'STRETCH' : parseLayoutAlignSelf(keyword)
}

/**
 * The width-to-height ratio an `aspect-ratio` value sizes a box by: a number, or a width and a
 * height either side of a slash, after an `auto` that leaves replaced content its own ratio.
 * Null for `auto` alone and for a ratio with a zero or negative side.
 */
export function parseCSSAspectRatio(value: string | undefined): number | null {
  if (!value) return null
  const nodes = valueParser(value).nodes.filter(
    (node) =>
      node.type !== 'space' &&
      node.type !== 'comment' &&
      !(node.type === 'word' && node.value.toLowerCase() === 'auto')
  )
  const [width, slash, height] = nodes
  if (width?.type !== 'word') return null
  const ratio = Number(width.value)
  if (nodes.length === 1) return ratio > 0 ? ratio : null
  if (nodes.length !== 3 || slash.type !== 'div' || slash.value !== '/' || height.type !== 'word') {
    return null
  }
  const down = Number(height.value)
  return ratio > 0 && down > 0 ? ratio / down : null
}
