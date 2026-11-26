import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { includedStrokeWeights, primaryAxisSpacingOf } from '@open-pencil/scene-graph/layout'

import type { DesignStyleDeclaration } from '../types'
import { borderWidths } from './css'
import type { FieldCSS } from './paint-style'

const px = (value: number) => `${value}px`

export type Side = 'top' | 'right' | 'bottom' | 'left'
export type Sides = Record<Side, number>

export const NO_SIDES: Sides = { top: 0, right: 0, bottom: 0, left: 0 }

const PADDING_SIDES = [
  ['paddingTop', 'top'],
  ['paddingRight', 'right'],
  ['paddingBottom', 'bottom'],
  ['paddingLeft', 'left']
] as const

/** A padding side changed by `extra` pixels, never below zero. */
function adjusted(value: string, literal: number, extra: number): string {
  if (extra === 0) return value
  if (value === px(literal)) return px(Math.max(0, literal + extra))
  return extra < 0 ? `max(0px, ${value} - ${px(-extra)})` : `calc(${value} + ${px(extra)})`
}

/**
 * A frame's padding, each side changed by `extra`: room a stroke takes or gives back, or the
 * overlap a negative gap takes back at the end. Sides compare by their CSS, so a token and a
 * literal of the same size stay separate.
 */
export function addPadding(
  style: DesignStyleDeclaration,
  node: SceneNode,
  css: FieldCSS,
  extra: Sides = NO_SIDES
): void {
  const [top, right, bottom, left] = PADDING_SIDES.map(([field, side]) =>
    adjusted(css(field, px(node[field])), node[field], extra[side])
  )
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
  // Between wrapped lines a set spacing holds, none included, and an unset one follows the items'.
  const wraps = node.layoutWrap === 'WRAP'
  const set = node.counterAxisSpacing
  const follows = set === null || (!wraps && set <= 0)
  if (follows && spacing > 0) {
    style.gap = item
    return
  }
  if (spacing > 0) style[along] = item
  if (set !== null && set > 0) style[across] = css('counterAxisSpacing', px(set))
  // Space between drops the gap along the rows; the space between them still follows it.
  else if (set === null && wraps && node.itemSpacing > 0) style[across] = item
}

/**
 * Where a wrapping frame puts its lines across: spread apart for space between, else packed
 * together where it aligns its children, as auto layout does. CSS stretches the lines by default.
 */
export function addWrappedLines(style: DesignStyleDeclaration, node: SceneNode): void {
  if (node.layoutWrap !== 'WRAP') return
  if (node.counterAxisAlignContent === 'SPACE_BETWEEN') style['align-content'] = 'space-between'
  else if (node.counterAxisAlign === 'CENTER') style['align-content'] = 'center'
  else if (node.counterAxisAlign === 'MAX') style['align-content'] = 'flex-end'
  else style['align-content'] = 'flex-start'
}

/** The side a frame's flow ends on, where the overlap of a negative gap is taken back. */
export function trailingSide(frame: SceneNode): Side {
  if (frame.layoutMode !== 'HORIZONTAL') return 'bottom'
  return frame.layoutDirection === 'RTL' ? 'left' : 'right'
}

/**
 * How far each child in a frame's flow overlaps the next: a negative gap, which CSS lays out as
 * none. Each child gives it up after itself and the frame takes it back at its end, so a hugging
 * frame still ends at its last child, as the canvas lays it out.
 */
export function flowOverlap(graph: SceneGraph, frame: SceneNode): number {
  if (frame.layoutMode !== 'HORIZONTAL' && frame.layoutMode !== 'VERTICAL') return 0
  const spacing = primaryAxisSpacingOf(frame)
  if (spacing >= 0) return 0
  const flow = graph
    .getChildren(frame.id)
    .filter((child) => child.visible && child.layoutPositioning !== 'ABSOLUTE')
  return flow.length > 1 ? -spacing : 0
}

/** A child's share of its frame's overlap: a negative margin after it. */
export function addOverlapMargin(
  style: DesignStyleDeclaration,
  graph: SceneGraph,
  node: SceneNode,
  parent: SceneNode | undefined
): void {
  if (!parent || node.layoutPositioning === 'ABSOLUTE') return
  const overlap = flowOverlap(graph, parent)
  if (overlap > 0) style[`margin-${trailingSide(parent)}`] = px(-overlap)
}

/**
 * The room a frame's padding gives or takes on each side. In preview a stroke takes room only as
 * it does on the canvas: drawn as shadows, it takes none, so the padding gives an included inside
 * stroke its room; a dashed one stays a border, and the padding gives back what the border takes
 * beyond that, as far as there is padding. Exported code keeps its borders and their room. A
 * negative gap's overlap is taken back at the flow's end.
 */
export function paddingExtra(
  graph: SceneGraph,
  node: SceneNode,
  preview: boolean,
  shadows: boolean
): Sides {
  const extra = { ...NO_SIDES }
  if (preview) {
    const border = shadows ? NO_SIDES : borderWidths(node)
    const included = includedStrokeWeights(node)
    for (const side of Object.keys(extra) as (keyof Sides)[])
      extra[side] = included[side] - border[side]
  }
  extra[trailingSide(node)] += flowOverlap(graph, node)
  return extra
}
