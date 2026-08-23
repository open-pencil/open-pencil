import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { CanvasGuide } from '@open-pencil/scene-graph/guides'

import { distanceToGuideSegment, getGuideScreenSegment, type GuideViewport } from './geometry'

export interface GuideHit {
  ownerId: string
  guideId: string
  axis: CanvasGuide['axis']
  position: number
  distance: number
}

export function hitTestGuides(
  graph: SceneGraph,
  pageId: string,
  viewport: GuideViewport,
  x: number,
  y: number,
  tolerance = 5
): GuideHit | null {
  const page = graph.getNode(pageId)
  if (!page) return null
  let closest: GuideHit | null = null

  const visit = (owner: SceneNode) => {
    for (const guide of owner.guides) {
      const distance = distanceToGuideSegment(
        x,
        y,
        getGuideScreenSegment(graph, owner, guide, viewport)
      )
      if (distance <= tolerance && (!closest || distance < closest.distance)) {
        closest = {
          ownerId: owner.id,
          guideId: guide.id,
          axis: guide.axis,
          position: guide.position,
          distance
        }
      }
    }
    for (const childId of owner.childIds) {
      const child = graph.getNode(childId)
      if (child) visit(child)
    }
  }

  visit(page)
  return closest
}
