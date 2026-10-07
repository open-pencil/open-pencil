import {
  FITTED_CONTAINER_TYPES,
  getAxisAlignedWorldBounds,
  getWorldMatrix,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/**
 * Figma's rotation of a transform: counterclockwise degrees in (-180, 180]. The plugin API and the
 * properties panel both report it; our nodes store a clockwise angle about their center.
 */
export function figmaRotation(matrix: Mat3): number {
  const degrees = (Math.atan2(-matrix[3], matrix[0]) * 180) / Math.PI
  // Figma reports the angle a script set, not its floating-point round trip.
  const rounded = Math.round(degrees * 1e6) / 1e6
  return Math.abs(degrees - rounded) < 1e-9 ? rounded + 0 : degrees
}

/** The nearest ancestor that sets a coordinate space: groups and booleans set none. */
function containerOf(node: SceneNode, graph: Pick<SceneGraph, 'getNode'>): SceneNode | undefined {
  let parent = node.parentId ? graph.getNode(node.parentId) : undefined
  while (parent && FITTED_CONTAINER_TYPES.has(parent.type)) {
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  }
  return parent
}

/**
 * X and Y as Figma's properties panel shows them: the top-left of the node's box on the canvas,
 * measured from its container's box, so a turned node reads where it starts on screen.
 */
export function panelPosition(node: SceneNode, graph: Pick<SceneGraph, 'getNode'>): Vector {
  const bounds = getAxisAlignedWorldBounds(node, graph)
  const container = containerOf(node, graph)
  const origin =
    container && container.type !== 'CANVAS'
      ? getAxisAlignedWorldBounds(container, graph)
      : { x: 0, y: 0 }
  return { x: bounds.x - origin.x, y: bounds.y - origin.y }
}

/** Rotation as Figma's properties panel shows it: on the canvas, counterclockwise, -180 as 180. */
export function panelRotation(node: SceneNode, graph: Pick<SceneGraph, 'getNode'>): number {
  const degrees = figmaRotation(getWorldMatrix(node, graph))
  return degrees === -180 ? 180 : degrees
}

/** The move that makes the panel show `value` for `axis`, as typing it in Figma's panel does. */
export function panelPositionChange(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode'>,
  axis: 'x' | 'y',
  value: number
): Pick<SceneNode, 'x' | 'y'> {
  const delta = value - panelPosition(node, graph)[axis]
  // The canvas move, in the axes of the node's parent.
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const parentWorld =
    parent && parent.type !== 'CANVAS' ? getWorldMatrix(parent, graph) : Matrix.identity()
  const linear = [parentWorld[0], parentWorld[1], 0, parentWorld[3], parentWorld[4], 0, 0, 0, 1]
  const toParent = Matrix.invert(linear) ?? Matrix.identity()
  const [dx, dy] = Matrix.mapPoints(toParent, axis === 'x' ? [delta, 0] : [0, delta])
  return { x: node.x + dx, y: node.y + dy }
}

/**
 * The turn that makes the panel show `degrees`: about the node's center, as Figma's panel turns
 * it. A flip on the node or its ancestors reverses which way the stored angle goes.
 */
export function panelRotationChange(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode'>,
  degrees: number
): Pick<SceneNode, 'rotation'> {
  const world = getWorldMatrix(node, graph)
  const mirrored = world[0] * world[4] - world[1] * world[3] < 0
  // The shortest way round, so the stored angle stays within a turn.
  const turn = ((((degrees - panelRotation(node, graph) + 180) % 360) + 360) % 360) - 180
  return { rotation: node.rotation + (mirrored ? turn : -turn) }
}
