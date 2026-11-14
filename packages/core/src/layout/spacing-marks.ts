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

/** A layer's start and end across the flow. */
function crossRange(node: SceneNode, child: SceneNode): [number, number] {
  return node.layoutMode === 'HORIZONTAL'
    ? [child.y, child.y + child.height]
    : [child.x, child.x + child.width]
}

/**
 * Where a gap spans across the flow: the content box, inside the paddings, or in a wrapped frame
 * its own line, the layers whose cross ranges meet the first layer's; null for a pair on two lines.
 */
function gapCrossRange(
  node: SceneNode,
  children: readonly SceneNode[],
  previous: SceneNode,
  next: SceneNode
): [number, number] | null {
  if (node.layoutWrap !== 'WRAP') {
    return node.layoutMode === 'HORIZONTAL'
      ? [node.paddingTop, node.height - node.paddingBottom]
      : [node.paddingLeft, node.width - node.paddingRight]
  }
  const [lineStart, lineEnd] = crossRange(node, previous)
  const meets = ([start, end]: [number, number]) => start < lineEnd && end > lineStart
  if (!meets(crossRange(node, next))) return null
  let line: [number, number] = [lineStart, lineEnd]
  for (const child of children) {
    const range = crossRange(node, child)
    if (meets(range)) line = [Math.min(line[0], range[0]), Math.max(line[1], range[1])]
  }
  return line
}

/** The gap between the flowed layers at `index` and `index + 1`, however much room it has. */
function gapBetween(
  node: SceneNode,
  children: readonly SceneNode[],
  index: number
): FlowGap | null {
  const previous = children.at(index)
  const next = children.at(index + 1)
  if (!previous || !next || index < 0) return null
  const cross = gapCrossRange(node, children, previous, next)
  if (!cross) return null
  const [crossStart, crossEnd] = cross
  const crossMiddle = (crossStart + crossEnd) / 2
  const isRow = node.layoutMode === 'HORIZONTAL'
  // The facing edges, whichever way the flow runs: right to left, the first layer is on the right.
  const start = isRow
    ? Math.min(previous.x + previous.width, next.x + next.width)
    : Math.min(previous.y + previous.height, next.y + next.height)
  const end = isRow ? Math.max(previous.x, next.x) : Math.max(previous.y, next.y)
  const middle = (start + end) / 2
  return isRow
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
}

/**
 * The gaps between flowed layers that have room between them. Across the flow a gap spans the
 * content box, inside the paddings, or in a wrapped frame its own line, and its tick sits in the
 * middle of it (Figma desktop, live).
 */
export function flowGaps(node: SceneNode, graph: SceneGraph): FlowGap[] {
  const children = flowChildren(node, graph)
  if (children.length < 2 || node.itemSpacing <= 0) return []
  const gaps: FlowGap[] = []
  for (let index = 0; index < children.length - 1; index++) {
    const gap = gapBetween(node, children, index)
    const room = gap && (node.layoutMode === 'HORIZONTAL' ? gap.rect.width : gap.rect.height)
    if (gap && room && room > 0) gaps.push(gap)
  }
  return gaps
}

/**
 * Where the tick of the gap after the flowed layer at `index` sits, even with no room in it, as
 * while its value is edited down to 0.
 */
export function gapTick(node: SceneNode, graph: SceneGraph, index: number): Vector | null {
  return gapBetween(node, flowChildren(node, graph), index)?.tick ?? null
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
