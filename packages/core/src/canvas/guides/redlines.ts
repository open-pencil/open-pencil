import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getAxisAlignedWorldBounds } from '@open-pencil/scene-graph/coordinate'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { GuideRedline } from './types'

function axisGap(axis: 'x' | 'y', position: number, bounds: Rect) {
  const start = axis === 'x' ? bounds.x : bounds.y
  const end = start + (axis === 'x' ? bounds.width : bounds.height)
  if (position < start) return { from: position, to: start, value: start - position }
  if (position > end) return { from: end, to: position, value: position - end }
  return null
}

function frameRedline(axis: 'x' | 'y', position: number, frame: SceneNode, graph: SceneGraph) {
  const bounds = getAxisAlignedWorldBounds(frame, graph)
  const gap = axisGap(axis, position, bounds)
  if (!gap) return null
  return {
    segment: {
      axis,
      ...gap,
      cross: axis === 'x' ? bounds.y + bounds.height / 2 : bounds.x + bounds.width / 2
    },
    targetId: frame.id
  } satisfies GuideRedline
}

function objectRedline(
  axis: 'x' | 'y',
  position: number,
  frame: SceneNode,
  graph: SceneGraph,
  deep: boolean
): GuideRedline | null {
  const frameBounds = getAxisAlignedWorldBounds(frame, graph)
  let closest: GuideRedline | null = null
  const visit = (owner: SceneNode) => {
    for (const childId of owner.childIds) {
      const child = graph.getNode(childId)
      if (!child || !child.visible) continue
      const bounds = getAxisAlignedWorldBounds(child, graph)
      const gap = axisGap(axis, position, bounds)
      if (gap) {
        const candidate = {
          segment: {
            axis,
            ...gap,
            cross:
              axis === 'x'
                ? Math.max(
                    frameBounds.y,
                    Math.min(frameBounds.y + frameBounds.height, bounds.y + bounds.height / 2)
                  )
                : Math.max(
                    frameBounds.x,
                    Math.min(frameBounds.x + frameBounds.width, bounds.x + bounds.width / 2)
                  )
          },
          targetId: child.id
        } satisfies GuideRedline
        if (!closest || candidate.segment.value < closest.segment.value) closest = candidate
      }
      if (deep) visit(child)
    }
  }
  visit(frame)
  return closest
}

export function computeGuideRedline(
  graph: SceneGraph,
  pageId: string,
  frameId: string,
  axis: 'x' | 'y',
  position: number,
  deep = false
): GuideRedline | null {
  const frame = graph.getNode(frameId)
  if (!frame || frame.parentId !== pageId) return null
  const frameBounds = getAxisAlignedWorldBounds(frame, graph)
  const coordinate = position
  const start = axis === 'x' ? frameBounds.x : frameBounds.y
  const end = start + (axis === 'x' ? frameBounds.width : frameBounds.height)
  return coordinate >= start && coordinate <= end
    ? objectRedline(axis, position, frame, graph, deep)
    : frameRedline(axis, position, frame, graph)
}
