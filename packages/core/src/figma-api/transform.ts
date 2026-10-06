import {
  getNodeLocalMatrix,
  getParentToContainerMatrix,
  localTransformFromWorld,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

/**
 * A node's transform into its container's space, which Figma's plugin API reports as
 * `relativeTransform` and reads `x`, `y`, and `rotation` from. Groups and booleans set no space of
 * their own, so the container is the nearest ancestor that is neither.
 */
export function containerTransform(node: SceneNode, scene: SceneGraph): Mat3 {
  return Matrix.multiply(getParentToContainerMatrix(node, scene), getNodeLocalMatrix(node))
}

/** Places a node so its transform into its container's space is `matrix`; scale and skew drop. */
export function setContainerTransform(scene: SceneGraph, node: SceneNode, matrix: Mat3): void {
  const toParent = Matrix.invert(getParentToContainerMatrix(node, scene)) ?? Matrix.identity()
  const local = localTransformFromWorld(node, Matrix.multiply(toParent, matrix), Matrix.identity())
  if (local) scene.updateNode(node.id, local)
}

/** Figma's rotation of a transform: counterclockwise degrees in (-180, 180]. */
export function figmaRotation(matrix: Mat3): number {
  const degrees = (Math.atan2(-matrix[3], matrix[0]) * 180) / Math.PI
  // Figma reports the angle a script set, not its floating-point round trip.
  const rounded = Math.round(degrees * 1e6) / 1e6
  return Math.abs(degrees - rounded) < 1e-9 ? rounded + 0 : degrees
}

/**
 * `matrix` turned to Figma's rotation `degrees` about its origin, the node's top-left corner, as
 * Figma's plugin API turns a node; its flip and position stay.
 */
export function withFigmaRotation(matrix: Mat3, degrees: number): Mat3 {
  const turn = Matrix.rotated(((figmaRotation(matrix) - degrees) * Math.PI) / 180)
  const linear = Matrix.multiply(turn, [matrix[0], matrix[1], 0, matrix[3], matrix[4], 0, 0, 0, 1])
  return [linear[0], linear[1], matrix[2], linear[3], linear[4], matrix[5], 0, 0, 1]
}

/** `matrix` moved so its origin is at `x`, `y`. */
export function withOrigin(matrix: Mat3, x: number, y: number): Mat3 {
  return [matrix[0], matrix[1], x, matrix[3], matrix[4], y, 0, 0, 1]
}
