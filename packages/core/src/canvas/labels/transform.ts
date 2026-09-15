import type { SceneGraph, SceneNode, Vector } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'

import {
  createSceneGeometry,
  viewportMatrix,
  type RotationPreview,
  type ViewportTransform
} from '#core/geometry'

/** Labels use a world-space anchor and orientation, but retain screen-sized typography. */
export function labelTransform(
  node: SceneNode,
  graph: SceneGraph,
  preview: RotationPreview | null | undefined,
  anchor: Vector = { x: 0, y: 0 }
) {
  const world = createSceneGeometry(graph, preview).unreflectedWorldMatrix(node)
  return {
    ...Matrix.mapPoint(world, anchor),
    rotation: (Math.atan2(world[3], world[0]) * 180) / Math.PI
  }
}

/**
 * Choose the most horizontal pair of edges, with left-to-right screen text.
 * The anchor uses normalized coordinates within that readable rectangle.
 */
export function frameLabelPlacement(
  node: SceneNode,
  graph: SceneGraph,
  preview: RotationPreview | null | undefined,
  anchor: Vector = { x: 0, y: 0 }
) {
  const world = createSceneGeometry(graph, preview).unreflectedWorldMatrix(node)
  const orientation = (Math.atan2(world[3], world[0]) * 180) / Math.PI
  const turns = Math.floor((orientation + 45) / 90)
  const corner = ((turns % 4) + 4) % 4
  const origin = Matrix.mapPoint(world, {
    x: corner >= 2 ? node.width : 0,
    y: corner === 1 || corner === 2 ? node.height : 0
  })
  const width = corner % 2 === 0 ? node.width : node.height
  const height = corner % 2 === 0 ? node.height : node.width
  const rotation = orientation - turns * 90
  const offset = Matrix.mapPoint(Matrix.rotated((rotation * Math.PI) / 180), {
    x: anchor.x * width,
    y: anchor.y * height
  })
  return { x: origin.x + offset.x, y: origin.y + offset.y, rotation, width, height }
}

type LabelTransform = ReturnType<typeof labelTransform>

function labelWorldMatrix(transform: LabelTransform, zoom: number) {
  return Matrix.multiply(
    Matrix.multiply(
      Matrix.translated(transform.x, transform.y),
      Matrix.rotated((transform.rotation * Math.PI) / 180)
    ),
    Matrix.scaled(1 / zoom, 1 / zoom)
  )
}

export function labelScreenMatrix(transform: LabelTransform, viewport: ViewportTransform) {
  return Matrix.multiply(viewportMatrix(viewport), labelWorldMatrix(transform, viewport.zoom))
}

export function labelLocalPoint(
  transform: LabelTransform,
  zoom: number,
  worldPoint: Vector
): Vector | null {
  const inverse = Matrix.invert(labelWorldMatrix(transform, zoom))
  return inverse ? Matrix.mapPoint(inverse, worldPoint) : null
}
