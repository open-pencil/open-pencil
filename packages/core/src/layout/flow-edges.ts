import { Edge, type Node as YogaNode } from 'yoga-layout'

import type { SceneNode } from '@open-pencil/scene-graph'

import { siblingOverlap } from './item-spacing'
import { layoutPadding } from './yoga-helpers'

type Side = 'top' | 'right' | 'bottom' | 'left'

const PHYSICAL_EDGE: Record<Side, Edge> = {
  top: Edge.Top,
  right: Edge.Right,
  bottom: Edge.Bottom,
  left: Edge.Left
}

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

function shortfall(length: number): number {
  return Math.min(0, length)
}

// Yoga clamps negative padding and gaps, so they become negative child margins on physical edges
// (a child reads logical edges in its own direction); a wrapping frame keeps its padding clamped.
export function setFlowEdges(
  yogaFrame: YogaNode,
  frame: SceneNode,
  flow: readonly YogaNode[],
  direction: 'LTR' | 'RTL'
): void {
  const overlap = flow.length > 0 ? siblingOverlap(frame) : 0
  const padding = layoutPadding(frame)
  const wraps = frame.layoutWrap === 'WRAP'
  const keepsNegativePadding = !wraps && Object.values(padding).some((length) => length < 0)
  if (overlap === 0 && !keepsNegativePadding) {
    return
  }
  const sides = flowSides(frame, direction)
  padding[sides.trailing] += overlap
  const margin = (side: Side) => (keepsNegativePadding ? shortfall(padding[side]) : 0)
  for (const side of Object.keys(PHYSICAL_EDGE) as Side[]) {
    yogaFrame.setPadding(PHYSICAL_EDGE[side], Math.max(0, padding[side]))
  }
  flow.forEach((child, index) => {
    const isFirst = index === 0
    const isLast = index === flow.length - 1
    child.setMargin(PHYSICAL_EDGE[sides.crossStart], margin(sides.crossStart))
    child.setMargin(PHYSICAL_EDGE[sides.crossEnd], margin(sides.crossEnd))
    child.setMargin(PHYSICAL_EDGE[sides.leading], isFirst ? margin(sides.leading) : 0)
    child.setMargin(PHYSICAL_EDGE[sides.trailing], -overlap + (isLast ? margin(sides.trailing) : 0))
  })
}
