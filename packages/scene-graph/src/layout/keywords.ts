import type { LayoutAlign, LayoutAlignSelf, LayoutCounterAlign, SceneNode } from '../types'

/**
 * Auto layout as the formats that author it spell it: flexbox keywords from CSS, design JSX,
 * and `.pen` files. Each format keeps its own syntax and defaults; what a keyword means for the
 * scene graph is decided here once, so `space-between` or `baseline` cannot mean one thing in
 * one format and fall back to start in another.
 */
export type AutoLayoutDirection = 'HORIZONTAL' | 'VERTICAL'

const DIRECTIONS = new Map<string, AutoLayoutDirection>([
  ['row', 'HORIZONTAL'],
  ['horizontal', 'HORIZONTAL'],
  ['column', 'VERTICAL'],
  ['col', 'VERTICAL'],
  ['vertical', 'VERTICAL']
])

const POSITIONS = new Map<string, 'MIN' | 'CENTER' | 'MAX'>([
  ['start', 'MIN'],
  ['flex-start', 'MIN'],
  ['center', 'CENTER'],
  ['end', 'MAX'],
  ['flex-end', 'MAX']
])

function keyword(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase()
}

/** The stack direction a `flex-direction`-like keyword names, or `undefined` for any other. */
export function parseAutoLayoutDirection(
  value: string | undefined
): AutoLayoutDirection | undefined {
  const name = keyword(value)
  return name === undefined ? undefined : DIRECTIONS.get(name)
}

/**
 * Primary axis alignment from a `justify-content` keyword. Auto layout has no
 * `space-around` or `space-evenly`, so those, like unknown keywords, give `undefined`.
 */
export function parsePrimaryAxisAlign(value: string | undefined): LayoutAlign | undefined {
  const name = keyword(value)
  if (name === undefined) return undefined
  if (name === 'space-between' || name === 'between') return 'SPACE_BETWEEN'
  return POSITIONS.get(name)
}

/** Cross axis alignment of a stack's children from an `align-items` keyword. */
export function parseCounterAxisAlign(value: string | undefined): LayoutCounterAlign | undefined {
  const name = keyword(value)
  if (name === undefined) return undefined
  if (name === 'stretch') return 'STRETCH'
  if (name === 'baseline') return 'BASELINE'
  return POSITIONS.get(name)
}

/** One child's cross axis alignment from an `align-self` keyword; `auto` follows the parent. */
export function parseLayoutAlignSelf(value: string | undefined): LayoutAlignSelf | undefined {
  return keyword(value) === 'auto' ? 'AUTO' : parseCounterAxisAlign(value)
}

type PaddingFields = Pick<
  SceneNode,
  'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'
>

/** Padding from one to four values in CSS shorthand order: top, right, bottom, left. */
export function paddingFromShorthand(values: readonly number[]): PaddingFields {
  const [top = 0, right = top, bottom = top, left = right] = values
  return { paddingTop: top, paddingRight: right, paddingBottom: bottom, paddingLeft: left }
}
