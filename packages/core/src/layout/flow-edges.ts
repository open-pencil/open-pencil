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

interface FlowSides {
  leading: Side
  trailing: Side
  crossStart: Side
  crossEnd: Side
}

function flowSides(frame: SceneNode, direction: 'LTR' | 'RTL'): FlowSides {
  if (frame.layoutMode !== 'HORIZONTAL') {
    return { leading: 'top', trailing: 'bottom', crossStart: 'left', crossEnd: 'right' }
  }
  const rtl = direction === 'RTL'
  return {
    leading: rtl ? 'right' : 'left',
    trailing: rtl ? 'left' : 'right',
    crossStart: 'top',
    crossEnd: 'bottom'
  }
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

// Figma's negative padding widens the box a wrapping frame's rows break in and moves every row,
// which margins on the children cannot do. Such a frame lays its children out in an inner box
// that takes the negative padding as margins.
function laysOutInFlowBox(frame: SceneNode): boolean {
  return (
    frame.layoutMode !== 'GRID' &&
    frame.layoutWrap === 'WRAP' &&
    Object.values(layoutPadding(frame)).some((length) => length < 0)
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
): { node: YogaNode; x: number; y: number } {
  if (!laysOutInFlowBox(frame) || yogaFrame.getChildCount() === 0) {
    return { node: yogaFrame, x: 0, y: 0 }
  }
  const box = yogaFrame.getChild(0)
  return { node: box, x: box.getComputedLeft(), y: box.getComputedTop() }
}

// Yoga clamps negative padding and gaps, so they become negative margins on physical edges (a
// child reads logical edges in its own direction): on the flow box when there is one, otherwise
// on the in-flow children touching each side.
export function setFlowEdges(
  yogaFrame: YogaNode,
  box: YogaNode,
  frame: SceneNode,
  flow: readonly YogaNode[],
  direction: 'LTR' | 'RTL'
): void {
  const overlap = flow.length > 1 ? siblingOverlap(frame) : 0
  const padding = layoutPadding(frame)
  if (overlap === 0 && Object.values(padding).every((length) => length >= 0)) {
    return
  }
  const sides = flowSides(frame, direction)
  padding[sides.trailing] += overlap
  const shortfall = (side: Side) => Math.min(0, padding[side])
  for (const side of SIDES) {
    yogaFrame.setPadding(PHYSICAL_EDGE[side], Math.max(0, padding[side]))
  }
  const inBox = box !== yogaFrame
  if (inBox) {
    for (const side of SIDES) box.setMargin(PHYSICAL_EDGE[side], shortfall(side))
  }
  const margin = (side: Side) => (inBox ? 0 : shortfall(side))
  flow.forEach((child, index) => {
    const isFirst = index === 0
    const isLast = index === flow.length - 1
    child.setMargin(PHYSICAL_EDGE[sides.crossStart], margin(sides.crossStart))
    child.setMargin(PHYSICAL_EDGE[sides.crossEnd], margin(sides.crossEnd))
    child.setMargin(PHYSICAL_EDGE[sides.leading], isFirst ? margin(sides.leading) : 0)
    child.setMargin(PHYSICAL_EDGE[sides.trailing], -overlap + (isLast ? margin(sides.trailing) : 0))
  })
}
