import {
  Align,
  Edge,
  FlexDirection,
  Gutter,
  Justify,
  Wrap,
  type Node as YogaNode
} from 'yoga-layout'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { primaryAxisGap, siblingOverlap } from './item-spacing'
import { createYogaNode, layoutPadding, mapAlign, mapJustify } from './yoga-helpers'

type Side = 'top' | 'right' | 'bottom' | 'left'

const PHYSICAL_EDGE: Record<Side, Edge> = {
  top: Edge.Top,
  right: Edge.Right,
  bottom: Edge.Bottom,
  left: Edge.Left
}

const SIDES = Object.keys(PHYSICAL_EDGE) as Side[]

// The side a frame's flow ends on, which takes back the overlap of a negative gap.
function trailingSide(frame: SceneNode, direction: 'LTR' | 'RTL'): Side {
  if (frame.layoutMode !== 'HORIZONTAL') return 'bottom'
  return direction === 'RTL' ? 'left' : 'right'
}

/** How an auto layout frame lines up its children: axis, wrapping, alignment, and gaps. */
export function setFlexFlow(yogaNode: YogaNode, frame: SceneNode): void {
  const horizontal = frame.layoutMode === 'HORIZONTAL'
  yogaNode.setFlexDirection(horizontal ? FlexDirection.Row : FlexDirection.Column)
  yogaNode.setFlexWrap(frame.layoutWrap === 'WRAP' ? Wrap.Wrap : Wrap.NoWrap)
  yogaNode.setJustifyContent(mapJustify(frame.primaryAxisAlign))
  yogaNode.setAlignItems(mapAlign(frame.counterAxisAlign))
  if (frame.layoutWrap === 'WRAP' && frame.counterAxisAlignContent === 'SPACE_BETWEEN') {
    yogaNode.setAlignContent(Align.SpaceBetween)
  }
  const primaryGap = primaryAxisGap(frame)
  yogaNode.setGap(Gutter.Column, horizontal ? primaryGap : frame.counterAxisSpacing)
  yogaNode.setGap(Gutter.Row, horizontal ? frame.counterAxisSpacing : primaryGap)
}

// Yoga clamps negative padding, while Figma lets it grow the box its children are laid out in past
// the frame's edges: they align, stretch, grow, and wrap within it. Such a frame lays its children
// out in an inner flow box that takes the negative padding as its margins.
function laysOutInFlowBox(frame: SceneNode): boolean {
  return (
    frame.layoutMode !== 'GRID' && Object.values(layoutPadding(frame)).some((length) => length < 0)
  )
}

/** The Yoga node a frame's children go into: the frame's own, or its flow box. */
export function insertFlowBox(yogaFrame: YogaNode, frame: SceneNode): YogaNode {
  if (!laysOutInFlowBox(frame)) return yogaFrame
  const box = createYogaNode()
  setFlexFlow(box, frame)
  box.setFlexGrow(1)
  box.setFlexShrink(1)
  yogaFrame.setFlexWrap(Wrap.NoWrap)
  yogaFrame.setJustifyContent(Justify.FlexStart)
  yogaFrame.setAlignItems(Align.Stretch)
  yogaFrame.setAlignContent(Align.FlexStart)
  yogaFrame.setGap(Gutter.All, 0)
  yogaFrame.insertChild(box, 0)
  return box
}

/** The laid-out Yoga node holding a frame's children, and where it sits in the frame. */
export function laidOutFlowBox(
  yogaFrame: YogaNode,
  frame: SceneNode
): { node: YogaNode; origin: Vector } {
  if (!laysOutInFlowBox(frame) || yogaFrame.getChildCount() === 0) {
    return { node: yogaFrame, origin: { x: 0, y: 0 } }
  }
  const box = yogaFrame.getChild(0)
  return { node: box, origin: { x: box.getComputedLeft(), y: box.getComputedTop() } }
}

/**
 * Lays out what Yoga clamps: each in-flow child gives up a negative gap's overlap after it, and the
 * frame takes it back on its trailing side, so a hugging frame ends at its last child; a negative
 * side becomes a margin of the flow box. Margins go on physical edges, as a child reads logical
 * ones in its own direction.
 */
export function setFlowEdges(
  yogaFrame: YogaNode,
  box: YogaNode,
  frame: SceneNode,
  flow: readonly YogaNode[],
  direction: 'LTR' | 'RTL'
): void {
  const overlap = flow.length > 1 ? siblingOverlap(frame) : 0
  const padding = layoutPadding(frame)
  if (overlap === 0 && box === yogaFrame) return
  const trailing = trailingSide(frame, direction)
  padding[trailing] += overlap
  for (const side of SIDES) {
    yogaFrame.setPadding(PHYSICAL_EDGE[side], Math.max(0, padding[side]))
    if (box !== yogaFrame) box.setMargin(PHYSICAL_EDGE[side], Math.min(0, padding[side]))
  }
  if (overlap === 0) return
  for (const child of flow) child.setMargin(PHYSICAL_EDGE[trailing], -overlap)
}
