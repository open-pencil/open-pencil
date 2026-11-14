import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import type { CanvasGuide } from '@open-pencil/scene-graph/guides'
import Matrix from '@open-pencil/scene-graph/matrix'

import { worldXToScreen, worldYToScreen } from '#core/geometry/viewport'

export interface GuideViewport {
  panX: number
  panY: number
  zoom: number
  width: number
  height: number
}

export interface GuideScreenSegment {
  x1: number
  y1: number
  x2: number
  y2: number
}

export function getGuideScreenSegment(
  graph: SceneGraph,
  owner: SceneNode,
  guide: Pick<CanvasGuide, 'axis' | 'position'>,
  viewport: GuideViewport
): GuideScreenSegment {
  if (owner.type === 'CANVAS') {
    if (guide.axis === 'x') {
      const x = worldXToScreen(viewport, guide.position)
      return { x1: x, y1: 0, x2: x, y2: viewport.height }
    }
    const y = worldYToScreen(viewport, guide.position)
    return { x1: 0, y1: y, x2: viewport.width, y2: y }
  }

  const matrix = getWorldMatrix(owner, graph)
  const start = Matrix.mapPoint(
    matrix,
    guide.axis === 'x' ? { x: guide.position, y: 0 } : { x: 0, y: guide.position }
  )
  const end = Matrix.mapPoint(
    matrix,
    guide.axis === 'x'
      ? { x: guide.position, y: owner.height }
      : { x: owner.width, y: guide.position }
  )
  return {
    x1: worldXToScreen(viewport, start.x),
    y1: worldYToScreen(viewport, start.y),
    x2: worldXToScreen(viewport, end.x),
    y2: worldYToScreen(viewport, end.y)
  }
}

export function distanceToGuideSegment(x: number, y: number, segment: GuideScreenSegment): number {
  const dx = segment.x2 - segment.x1
  const dy = segment.y2 - segment.y1
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared))
  return Math.hypot(x - (segment.x1 + t * dx), y - (segment.y1 + t * dy))
}
