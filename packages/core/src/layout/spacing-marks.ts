import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

/**
 * Where Figma marks an auto layout frame's paddings and gaps when it is hovered, in the frame's
 * own coordinates: the canvas draws the marks from here and the pointer hits them here.
 */

export type PaddingSide = 'top' | 'right' | 'bottom' | 'left'

export const PADDING_SIDES: readonly PaddingSide[] = ['top', 'right', 'bottom', 'left']

/** The layers an auto layout frame lays out in its flow: shown, and not placed absolutely. */
export function flowChildren(node: SceneNode, graph: SceneGraph): SceneNode[] {
  return node.childIds
    .map((id) => graph.getNode(id))
    .filter(
      (child): child is SceneNode =>
        !!child && child.visible && child.layoutPositioning !== 'ABSOLUTE'
    )
}

/** The gap after the flowed layer at `index`, and the point its tick marks. */
export interface FlowGap {
  readonly index: number
  readonly rect: Rect
  readonly tick: Vector
}

/**
 * The gaps between flowed layers that have room between them. Across the flow a gap spans the
 * content box, inside the paddings, and its tick sits in the middle of it (Figma desktop, live).
 */
export function flowGaps(node: SceneNode, graph: SceneGraph): FlowGap[] {
  const children = flowChildren(node, graph)
  if (children.length < 2 || node.itemSpacing <= 0) return []
  const isRow = node.layoutMode === 'HORIZONTAL'
  const crossStart = isRow ? node.paddingTop : node.paddingLeft
  const crossEnd = isRow ? node.height - node.paddingBottom : node.width - node.paddingRight
  const crossMiddle = (crossStart + crossEnd) / 2
  const gaps: FlowGap[] = []
  for (let index = 0; index < children.length - 1; index++) {
    const previous = children[index]
    const next = children[index + 1]
    const start = isRow ? previous.x + previous.width : previous.y + previous.height
    const end = isRow ? next.x : next.y
    if (end <= start) continue
    const middle = (start + end) / 2
    gaps.push(
      isRow
        ? {
            index,
            rect: { x: start, y: crossStart, width: end - start, height: crossEnd - crossStart },
            tick: { x: middle, y: crossMiddle }
          }
        : {
            index,
            rect: { x: crossStart, y: start, width: crossEnd - crossStart, height: end - start },
            tick: { x: crossMiddle, y: middle }
          }
    )
  }
  return gaps
}

/** A padding's band along its whole side. */
export function paddingRect(node: SceneNode, side: PaddingSide): Rect {
  const { width, height } = node
  if (side === 'top') return { x: 0, y: 0, width, height: node.paddingTop }
  if (side === 'bottom') {
    return { x: 0, y: height - node.paddingBottom, width, height: node.paddingBottom }
  }
  if (side === 'left') return { x: 0, y: 0, width: node.paddingLeft, height }
  return { x: width - node.paddingRight, y: 0, width: node.paddingRight, height }
}

/** A padding's tick: the middle of its band, across from the frame's middle. */
export function paddingTick(node: SceneNode, side: PaddingSide): Vector {
  const { x, y, width, height } = paddingRect(node, side)
  return { x: x + width / 2, y: y + height / 2 }
}

/** The padding on `side`. */
export function paddingOf(node: SceneNode, side: PaddingSide): number {
  if (side === 'top') return node.paddingTop
  if (side === 'right') return node.paddingRight
  if (side === 'bottom') return node.paddingBottom
  return node.paddingLeft
}
