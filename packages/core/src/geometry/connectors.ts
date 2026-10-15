import { connectorLineEnds, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { createSceneGeometry } from './scene'
import type { RotationPreview, ViewportTransform } from './types'

/** Where a connector's line starts and ends on screen, where its end handles sit. */
export function connectorScreenEnds(
  graph: SceneGraph,
  connector: SceneNode,
  viewport: ViewportTransform,
  preview?: RotationPreview | null
): { start: Vector; end: Vector } | null {
  const ends = connectorLineEnds(graph, connector)
  if (!ends) return null
  const { line, start, end } = ends
  const [sx, sy, ex, ey] = Matrix.mapPoints(
    createSceneGeometry(graph, preview).screenMatrix(line, viewport),
    [start.x, start.y, end.x, end.y]
  )
  return { start: { x: sx, y: sy }, end: { x: ex, y: ey } }
}
