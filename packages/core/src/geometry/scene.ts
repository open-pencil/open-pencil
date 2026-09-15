import type { SceneGraph, SceneNode, Vector } from '@open-pencil/scene-graph'
import {
  getAxisAlignedWorldBounds,
  getNodeLocalMatrix,
  getNodeRotationOrigin,
  getWorldHandles,
  getWorldMatrix
} from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import type { RotationPreview, ViewportTransform } from './types'

export function projectedNode(node: SceneNode, preview?: RotationPreview | null): SceneNode {
  return node.id === preview?.nodeId ? { ...node, rotation: preview.angle } : node
}

/** Shares the scene graph's pivot/reflection convention; excludes separately applied x/y. */
export function nodeOrientationMatrix(node: SceneNode, preview?: RotationPreview | null) {
  return getNodeLocalMatrix(projectedNode(node, preview), { x: 0, y: 0 })
}

export function viewportMatrix(viewport: ViewportTransform) {
  return Matrix.multiply(
    Matrix.translated(viewport.panX, viewport.panY),
    Matrix.scaled(viewport.zoom, viewport.zoom)
  )
}

/** A read-only view for one draw or input operation. Recreate when the preview changes. */
export function createSceneGeometry(graph: SceneGraph, preview?: RotationPreview | null) {
  const node = (source: SceneNode) => projectedNode(source, preview)
  const reader = {
    getNode(id: string) {
      const source = graph.getNode(id)
      return source ? node(source) : undefined
    }
  }
  const worldMatrix = (source: SceneNode) => getWorldMatrix(node(source), reader)
  const screenMatrix = (source: SceneNode, viewport: ViewportTransform) =>
    Matrix.multiply(viewportMatrix(viewport), worldMatrix(source))

  function toLocal(source: SceneNode, point: Vector): Vector | null {
    const inverse = Matrix.invert(worldMatrix(source))
    return inverse ? Matrix.mapPoint(inverse, point) : null
  }

  function screenToLocal(
    source: SceneNode,
    point: Vector,
    viewport: ViewportTransform
  ): Vector | null {
    const inverse = Matrix.invert(screenMatrix(source, viewport))
    return inverse ? Matrix.mapPoint(inverse, point) : null
  }

  function reflections(source: SceneNode): Vector {
    let current: SceneNode | undefined = node(source)
    let x = 1
    let y = 1
    while (current) {
      if (current.flipX) x *= -1
      if (current.flipY) y *= -1
      current = current.parentId ? reader.getNode(current.parentId) : undefined
    }
    return { x, y }
  }

  return {
    node,
    reflections,
    worldMatrix,
    screenMatrix,
    toLocal,
    screenToLocal,
    localMatrix: (source: SceneNode) => getNodeLocalMatrix(node(source)),
    toWorld: (source: SceneNode, point: Vector) => Matrix.mapPoint(worldMatrix(source), point),
    toScreen: (source: SceneNode, point: Vector, viewport: ViewportTransform) =>
      Matrix.mapPoint(screenMatrix(source, viewport), point),
    bounds: (source: SceneNode) => getAxisAlignedWorldBounds(node(source), reader),
    handles: (source: SceneNode, rect?: Rect) => getWorldHandles(node(source), reader, rect),
    direction(source: SceneNode, vector: Vector): Vector {
      const m = worldMatrix(source)
      return { x: m[0] * vector.x + m[1] * vector.y, y: m[3] * vector.x + m[4] * vector.y }
    },
    /** Same world-space rectangle, with reflected axes removed for readable labels. */
    unreflectedWorldMatrix(source: SceneNode) {
      const world = worldMatrix(source)
      const { x: flipX, y: flipY } = reflections(source)
      const origin = Matrix.mapPoint(world, {
        x: flipX < 0 ? source.width : 0,
        y: flipY < 0 ? source.height : 0
      })
      world[0] *= flipX
      world[3] *= flipX
      world[1] *= flipY
      world[4] *= flipY
      world[2] = origin.x
      world[5] = origin.y
      return world
    },
    rotationOrigin(source: SceneNode): Vector {
      return Matrix.mapPoint(worldMatrix(source), getNodeRotationOrigin(node(source)))
    },
    rotationDirection(source: SceneNode): 1 | -1 {
      const m = worldMatrix(source)
      return m[0] * m[4] - m[1] * m[3] < 0 ? -1 : 1
    },
    rotation(source: SceneNode) {
      const world = worldMatrix(source)
      return (Math.atan2(world[3], world[0]) * 180) / Math.PI
    }
  }
}

export type SceneGeometry = ReturnType<typeof createSceneGeometry>
