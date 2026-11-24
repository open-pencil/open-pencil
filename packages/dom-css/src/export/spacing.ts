import type { SceneNode } from '@open-pencil/scene-graph'
import { includedStrokeWeights, primaryAxisSpacingOf } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { borderWidths } from './css'
import type { FieldCSS } from './paint-style'

const px = (value: number) => `${value}px`

const PADDING_SIDES = [
  ['paddingTop', 'top'],
  ['paddingRight', 'right'],
  ['paddingBottom', 'bottom'],
  ['paddingLeft', 'left']
] as const

/**
 * Sides compare by their CSS, so a token and a literal of the same size stay separate. With
 * `absorbBorder`, the padding gives up the room a border takes where the stroke takes none on the
 * canvas, as far as there is padding to give.
 */
export function addPadding(
  style: DesignStyleDeclaration,
  node: SceneNode,
  css: FieldCSS,
  absorbBorder: boolean
): void {
  const border = borderWidths(node)
  const included = includedStrokeWeights(node)
  const [top, right, bottom, left] = PADDING_SIDES.map(([field, side]) => {
    const literal = px(node[field])
    const value = css(field, literal)
    const extra = absorbBorder ? border[side] - included[side] : 0
    if (extra <= 0) return value
    if (value === literal) return px(Math.max(0, node[field] - extra))
    return `max(0px, ${value} - ${px(extra)})`
  })
  const zero = px(0)
  if ([top, right, bottom, left].every((value) => value === zero)) return

  if (top === right && right === bottom && bottom === left) {
    style.padding = top
    return
  }

  if (top === bottom && right === left) {
    if (top !== zero) style['padding-block'] = top
    if (right !== zero) style['padding-inline'] = right
    return
  }

  if (top !== zero) style['padding-top'] = top
  if (right !== zero) style['padding-right'] = right
  if (bottom !== zero) style['padding-bottom'] = bottom
  if (left !== zero) style['padding-left'] = left
}

export function addFlexGap(style: DesignStyleDeclaration, node: SceneNode, css: FieldCSS): void {
  const spacing = primaryAxisSpacingOf(node)
  const item = css('itemSpacing', px(node.itemSpacing))
  const [along, across] =
    node.layoutMode === 'HORIZONTAL'
      ? (['column-gap', 'row-gap'] as const)
      : (['row-gap', 'column-gap'] as const)
  const counter = node.counterAxisSpacing ?? 0
  if (counter > 0) {
    if (spacing > 0) style[along] = item
    style[across] = css('counterAxisSpacing', px(counter))
  } else if (spacing > 0) {
    style.gap = item
  } else if (
    node.itemSpacing > 0 &&
    node.layoutWrap === 'WRAP' &&
    node.counterAxisSpacing === null
  ) {
    // Space between drops the gap along the rows; the space between them still follows it.
    style[across] = item
  }
}
