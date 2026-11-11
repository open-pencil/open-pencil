import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import type { Edges, LayoutNode } from '@open-pencil/taffy'

import { primaryAxisGap, siblingOverlap } from './item-spacing'
import { createLayoutNode, layoutPadding, mapAlign, mapJustify } from './node'

type Side = 'top' | 'right' | 'bottom' | 'left'

// The side a frame's flow ends on, which takes back the overlap of a negative gap.
function trailingSide(frame: SceneNode, direction: 'LTR' | 'RTL'): Side {
  if (frame.layoutMode !== 'HORIZONTAL') return 'bottom'
  return direction === 'RTL' ? 'left' : 'right'
}

/** How an auto layout frame lines up its children: axis, wrapping, alignment, and gaps. */
export function setFlexFlow(layoutNode: LayoutNode, frame: SceneNode): void {
  const horizontal = frame.layoutMode === 'HORIZONTAL'
  layoutNode.style.flexDirection = horizontal ? 'row' : 'column'
  layoutNode.style.flexWrap = frame.layoutWrap === 'WRAP' ? 'wrap' : 'nowrap'
  layoutNode.style.justifyContent = mapJustify(frame.primaryAxisAlign)
  layoutNode.style.alignItems = mapAlign(frame.counterAxisAlign)
  if (frame.layoutWrap === 'WRAP' && frame.counterAxisAlignContent === 'SPACE_BETWEEN') {
    layoutNode.style.alignContent = 'space-between'
  }
  const primaryGap = primaryAxisGap(frame)
  // Wrapped lines never overlap: Figma lays a negative spacing between them out as none.
  const counterGap = Math.max(0, frame.counterAxisSpacing)
  layoutNode.style.columnGap = horizontal ? primaryGap : counterGap
  layoutNode.style.rowGap = horizontal ? counterGap : primaryGap
}

// CSS clamps negative padding, while Figma lets it grow the box its children are laid out in past
// the frame's edges: they align, stretch, grow, and wrap within it. Such a frame lays its children
// out in an inner flow box that takes the negative padding as its margins.
function laysOutInFlowBox(frame: SceneNode): boolean {
  return (
    frame.layoutMode !== 'GRID' && Object.values(layoutPadding(frame)).some((length) => length < 0)
  )
}

/** The layout node a frame's children go into: the frame's own, or its flow box. */
export function insertFlowBox(frameNode: LayoutNode, frame: SceneNode): LayoutNode {
  if (!laysOutInFlowBox(frame)) return frameNode
  const box = createLayoutNode()
  // Direction is not inherited from the frame's node, as each node takes its own.
  box.style.direction = frameNode.style.direction
  setFlexFlow(box, frame)
  box.style.flexGrow = 1
  box.style.flexShrink = 1
  frameNode.style.flexWrap = 'nowrap'
  frameNode.style.justifyContent = 'flex-start'
  frameNode.style.alignItems = 'stretch'
  frameNode.style.alignContent = 'flex-start'
  frameNode.style.columnGap = 0
  frameNode.style.rowGap = 0
  frameNode.append(box)
  return box
}

/** The laid-out node holding a frame's children, and where it sits in the frame. */
export function laidOutFlowBox(
  frameNode: LayoutNode,
  frame: SceneNode
): { node: LayoutNode; origin: Vector } {
  if (!laysOutInFlowBox(frame) || frameNode.children.length === 0) {
    return { node: frameNode, origin: { x: 0, y: 0 } }
  }
  const box = frameNode.children[0]
  return { node: box, origin: { x: box.layout.left, y: box.layout.top } }
}

/**
 * Lays out what CSS clamps: each in-flow child gives up a negative gap's overlap after it, and the
 * frame takes it back on its trailing side, so a hugging frame ends at its last child; a negative
 * side becomes a margin of the flow box. Margins go on physical edges, as a child reads logical
 * ones in its own direction.
 */
export function setFlowEdges(
  frameNode: LayoutNode,
  box: LayoutNode,
  frame: SceneNode,
  flow: readonly LayoutNode[],
  direction: 'LTR' | 'RTL'
): void {
  const overlap = flow.length > 1 ? siblingOverlap(frame) : 0
  const padding = layoutPadding(frame)
  if (overlap === 0 && box === frameNode) return
  const trailing = trailingSide(frame, direction)
  padding[trailing] += overlap
  const sides: Side[] = ['top', 'right', 'bottom', 'left']
  const outer: Edges = {}
  const inner: Edges = {}
  for (const side of sides) {
    outer[side] = Math.max(0, padding[side])
    inner[side] = Math.min(0, padding[side])
  }
  frameNode.style.padding = outer
  if (box !== frameNode) box.style.margin = inner
  if (overlap === 0) return
  for (const child of flow) child.style.margin = { ...child.style.margin, [trailing]: -overlap }
}
