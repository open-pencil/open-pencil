import type { SceneGraph } from './graph'
import Matrix, { type Mat3 } from './matrix'
import { FITTED_CONTAINER_TYPES } from './node-defaults'
import type { Rect, Vector } from './primitives'
import type { SceneNode } from './types'

export function getWorldMatrix(node: SceneNode, graph: Pick<SceneGraph, 'getNode'>): Mat3 {
  const chain: SceneNode[] = []
  let current: SceneNode | undefined = node

  while (current) {
    chain.unshift(current)
    if (!current.parentId) break
    current = graph.getNode(current.parentId)
  }

  let matrix = Matrix.identity()

  for (const n of chain) {
    const local = getNodeLocalMatrix(n)
    matrix = Matrix.multiply(matrix, local)
  }

  return matrix
}

/** Axis-aligned box around interleaved `x, y` points; empty input gives an empty box at the origin. */
function boundsOfPoints(points: readonly number[]): Rect {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxX = Math.max(maxX, points[i])
    maxY = Math.max(maxY, points[i + 1])
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function cornersOf(node: Pick<SceneNode, 'width' | 'height'>): number[] {
  return [0, 0, node.width, 0, node.width, node.height, 0, node.height]
}

export function getAxisAlignedWorldBounds(node: SceneNode, graph: Pick<SceneGraph, 'getNode'>) {
  return boundsOfPoints(Matrix.mapPoints(getWorldMatrix(node, graph), cornersOf(node)))
}

/** World matrix of a parent; the document root and a missing parent are the identity. */
export function getParentWorldMatrix(
  parent: SceneNode | undefined,
  graph: Pick<SceneGraph, 'getNode' | 'rootId'>
): Mat3 {
  if (!parent || parent.id === graph.rootId) return Matrix.identity()
  return getWorldMatrix(parent, graph)
}

/**
 * Axis-aligned box of `nodes` in `parentId`'s own axes: where a group, frame, or boolean operation
 * made from them sits. Each node's corners are mapped through the parent's inverse world matrix,
 * so a rotated or flipped parent gets a box in its own axes and the nodes keep their drawn places
 * once they move into the container.
 */
export function getAxisAlignedBoundsInParent(
  nodes: readonly SceneNode[],
  parentId: string,
  graph: Pick<SceneGraph, 'getNode' | 'rootId'>
): Rect {
  const toParent =
    Matrix.invert(getParentWorldMatrix(graph.getNode(parentId), graph)) ?? Matrix.identity()
  const points = nodes.flatMap((node) =>
    Matrix.mapPoints(Matrix.multiply(toParent, getWorldMatrix(node, graph)), cornersOf(node))
  )
  return boundsOfPoints(points)
}

export function getAbsolutePosition(node: SceneNode, graph: SceneGraph): Vector {
  const matrix = getWorldMatrix(node, graph)
  const p = Matrix.mapPoints(matrix, [0, 0])

  return {
    x: p[0],
    y: p[1]
  }
}
export function getAbsoluteRotation(node: SceneNode, graph: SceneGraph): number {
  const matrix = getWorldMatrix(node, graph)
  const a = matrix[0]
  const b = matrix[1]
  const angle = Math.atan2(b, a)
  let deg = (angle * 180) / Math.PI
  deg = (deg + 360) % 360

  return deg
}

export function getAbsolutePositionFull(node: SceneNode, graph: SceneGraph) {
  const matrix = getWorldMatrix(node, graph)

  const origin = Matrix.mapPoints(matrix, [0, 0])
  const x = origin[0]
  const y = origin[1]

  const pts = Matrix.mapPoints(matrix, [
    0,
    0,
    node.width,
    0,
    node.width,
    node.height,
    0,
    node.height
  ])

  const [x1, y1, x2, y2, x3, y3, x4, y4] = pts

  const minX = Math.min(x1, x2, x3, x4)
  const maxX = Math.max(x1, x2, x3, x4)
  const minY = Math.min(y1, y2, y3, y4)
  const maxY = Math.max(y1, y2, y3, y4)

  const width = maxX - minX
  const height = maxY - minY

  let angle = Math.atan2(matrix[3], matrix[0])

  const det = matrix[0] * matrix[4] - matrix[1] * matrix[3]
  if (det < 0) {
    angle = -angle
  }

  const rotation = angle * (180 / Math.PI)

  const center = Matrix.mapPoints(matrix, [node.width / 2, node.height / 2])

  const centerX = center[0]
  const centerY = center[1]

  return {
    x,
    y,

    // AABB
    boundX: minX,
    boundY: minY,
    width,
    height,

    rotation,

    centerX,
    centerY
  }
}
/** Lines retain their origin pivot; other shapes rotate around their center. */
export function getNodeRotationOrigin(node: Pick<SceneNode, 'type' | 'width' | 'height'>): Vector {
  return node.type === 'LINE' ? { x: 0, y: 0 } : { x: node.width / 2, y: node.height / 2 }
}

/** What places a layer in its parent: its position, size, reflection, turn, and pivot. */
export type NodePlacement = Pick<
  SceneNode,
  'type' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'
>

/** Position can be applied separately by renderers before setting up local opacity layers. */
export function getNodeLocalMatrix(n: NodePlacement, position: Vector = n) {
  let matrix = Matrix.translated(position.x, position.y)
  if (n.flipX || n.flipY) {
    matrix = Matrix.multiply(
      matrix,
      Matrix.scaled(n.flipX ? -1 : 1, n.flipY ? -1 : 1, n.width / 2, n.height / 2)
    )
  }
  if (n.rotation) {
    const pivot = getNodeRotationOrigin(n)
    matrix = Matrix.multiply(matrix, Matrix.rotated((n.rotation * Math.PI) / 180, pivot.x, pivot.y))
  }
  return matrix
}
export function getNodeWorldBounds(node: SceneNode) {
  return boundsOfPoints(Matrix.mapPoints(getNodeLocalMatrix(node), cornersOf(node)))
}

/**
 * World-space positions of the 8 selection handles. `localRect` overrides the
 * node-local box the handles sit on — text-on-path draws its handles on the
 * glyph-fitted path box, not node bounds, so its hit-test must pass that box
 * or the visible handles are ~25px off and unclickable. Defaults to full node
 * bounds.
 */
export function getWorldHandles(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode'>,
  localRect?: Rect
) {
  const matrix = getWorldMatrix(node, graph)

  const x0 = localRect?.x ?? 0
  const y0 = localRect?.y ?? 0
  const w = localRect?.width ?? node.width
  const h = localRect?.height ?? node.height
  const mx = x0 + w / 2
  const my = y0 + h / 2
  const x1 = x0 + w
  const y1 = y0 + h

  const localPts = [
    x0,
    y0, // nw
    mx,
    y0, // n
    x1,
    y0, // ne
    x1,
    my, // e
    x1,
    y1, // se
    mx,
    y1, // s
    x0,
    y1, // sw
    x0,
    my // w
  ]

  const pts = Matrix.mapPoints(matrix, localPts)

  return {
    nw: { x: pts[0], y: pts[1] },
    n: { x: pts[2], y: pts[3] },
    ne: { x: pts[4], y: pts[5] },
    e: { x: pts[6], y: pts[7] },
    se: { x: pts[8], y: pts[9] },
    s: { x: pts[10], y: pts[11] },
    sw: { x: pts[12], y: pts[13] },
    w: { x: pts[14], y: pts[15] }
  }
}

type LocalTransform = Pick<SceneNode, 'x' | 'y' | 'rotation' | 'flipX' | 'flipY'>

/**
 * Local transform that draws `node` with the given world matrix once it sits under a parent
 * whose world matrix is `parentWorld`. Keeps the node's own `flipX` when the matrix allows it.
 */
export function localTransformFromWorld(
  node: SceneNode,
  world: Mat3,
  parentWorld: Mat3
): LocalTransform | null {
  const parentInverse = Matrix.invert(parentWorld)
  if (!parentInverse) return null
  const local = Matrix.multiply(parentInverse, world)
  const [a, b, , c, d] = local
  const sx = node.flipX ? -1 : 1
  const sy = a * d - b * c < 0 ? -sx : sx
  let rotation = (Math.atan2(sy * c, sx * a) * 180) / Math.PI
  if (Math.abs(rotation) < 1e-9) rotation = 0
  const transform = { rotation, flipX: sx < 0, flipY: sy < 0 }
  const origin = getNodeLocalMatrix({ ...node, ...transform }, { x: 0, y: 0 })
  return { ...transform, x: local[2] - origin[2], y: local[5] - origin[5] }
}

export function isTranslationOnly(matrix: Mat3): boolean {
  return matrix[0] === 1 && matrix[1] === 0 && matrix[3] === 0 && matrix[4] === 1
}

/**
 * Maps a node's parent space into its container's: through the groups and booleans around it,
 * which set no coordinate space of their own. Figma's plugin API reports `x`, `y`, and
 * `relativeTransform` of their children in the container's space. The identity when the parent is
 * not a group.
 */
export function getParentToContainerMatrix(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode'>
): Mat3 {
  let matrix = Matrix.identity()
  for (
    let parent = node.parentId ? graph.getNode(node.parentId) : undefined;
    parent && FITTED_CONTAINER_TYPES.has(parent.type);
    parent = parent.parentId ? graph.getNode(parent.parentId) : undefined
  ) {
    matrix = Matrix.multiply(getNodeLocalMatrix(parent), matrix)
  }
  return matrix
}

/**
 * A selected layer's place in a multi-selection's canvas bounds, taken when a resize starts so
 * every step re-places the layer from where it began rather than from its previewed state.
 */
export interface SelectionPlacement {
  node: SceneNode
  center: Vector
  /** Draws the layer from its own (0,0)…(width,height) on the canvas. */
  world: Mat3
  /** Draws the layer's parent on the canvas. */
  parentWorld: Mat3
  /** -1 when the layer is drawn mirrored, so its rotation turns the other way on the canvas. */
  direction: 1 | -1
  /** Maps canvas points into the layer's parent's space, or null when it cannot be inverted. */
  parentInverse: Mat3 | null
}

export function selectionPlacement(
  node: SceneNode,
  graph: Pick<SceneGraph, 'getNode' | 'rootId'>
): SelectionPlacement {
  const world = getWorldMatrix(node, graph)
  const [cx, cy] = Matrix.mapPoints(world, [node.width / 2, node.height / 2])
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  const parentWorld = getParentWorldMatrix(parent, graph)
  return {
    node: { ...node },
    center: { x: cx, y: cy },
    world,
    parentWorld,
    direction: world[0] * world[4] - world[1] * world[3] < 0 ? -1 : 1,
    parentInverse: Matrix.invert(parentWorld)
  }
}

/** The position, in its parent's space, that puts `node`'s center at a canvas point. */
function positionCenteredAt(node: SceneNode, parentInverse: Mat3 | null, center: Vector): Vector {
  const [px, py] = parentInverse
    ? Matrix.mapPoints(parentInverse, [center.x, center.y])
    : [center.x, center.y]
  // The local matrix translates last, so the layer's center at the origin gives the offset.
  const [qx, qy] = Matrix.mapPoints(getNodeLocalMatrix(node, { x: 0, y: 0 }), [
    node.width / 2,
    node.height / 2
  ])
  return { x: px - qx, y: py - qy }
}

export interface ResizedBoundsOptions {
  /** The layer is locked to its ratio: it scales evenly instead of stretching. */
  keepRatio?: boolean
  /** Adjusts a locked layer's sizes, such as to whole pixels. */
  round?: (size: number) => number
}

/** Where a layer sits in its parent and how large it is, with its angle and flips. */
export type LayerPlacement = Pick<
  SceneNode,
  'x' | 'y' | 'width' | 'height' | 'rotation' | 'flipX' | 'flipY'
>

/**
 * Where a layer lands, in its parent's space, when a multi-selection's canvas box `from` is
 * resized to `to`. Figma scales the layer's whole transform with the box, which skews a rotated
 * layer under an uneven scale. A layer here cannot skew, so it takes what Figma then reports for
 * it, and what a `.fig` file of that result opens as: its top-left corner and x axis where the
 * scale puts them, its width and height the scaled lengths of its own axes, and its y axis square
 * to its x axis. An even scale, or a layer upright in the box, comes out exactly as in Figma.
 */
export function placeInResizedBounds(
  placement: SelectionPlacement,
  from: Rect,
  to: Rect,
  { keepRatio = false, round = (size: number) => size }: ResizedBoundsOptions = {}
): LayerPlacement {
  const { node, world, parentWorld } = placement
  const scaleX = from.width > 0 ? to.width / from.width : 1
  const scaleY = from.height > 0 ? to.height / from.height : 1
  const scale = Matrix.multiply(
    Matrix.translated(to.x - from.x * scaleX, to.y - from.y * scaleY),
    Matrix.scaled(scaleX, scaleY)
  )
  const [a, b, tx, c, d, ty] = Matrix.multiply(scale, world)
  // The scaled axes: x along the first column, y along the second.
  const xLength = Math.hypot(a, c)
  const yLength = Math.hypot(b, d)
  // A layer locked to its ratio scales evenly, by the mean of the box's scales, as in Figma.
  const even = Math.sqrt(Math.abs(scaleX * scaleY))
  const width = keepRatio ? round(node.width * even) : node.width * xLength
  const height = keepRatio ? round(node.height * even) : node.height * yLength
  const ux = xLength > 0 ? a / xLength : 1
  const uy = xLength > 0 ? c / xLength : 0
  const mirrored = a * d - b * c < 0 ? -1 : 1
  const squared: Mat3 = [ux, -uy * mirrored, tx, uy, ux * mirrored, ty, 0, 0, 1]
  const sized = { ...node, width, height }
  const { x, y, rotation, flipX, flipY } =
    localTransformFromWorld(sized, squared, parentWorld) ?? node
  return { x, y, width, height, rotation, flipX, flipY }
}

/** A canvas pointer movement along the layer's own axes, as its handles measure it. */
export function canvasDeltaInLayer(placement: SelectionPlacement, dx: number, dy: number): Vector {
  const [a, b, , c, d] = placement.world
  const det = a * d - b * c
  if (det === 0) return { x: dx, y: dy }
  return { x: (d * dx - b * dy) / det, y: (a * dy - c * dx) / det }
}

/**
 * Where a layer lands when one of its handles resizes it in its own frame, from `from` to `to`,
 * both its box in its parent's axes as an upright layer would have it. `to` is signed: a handle
 * dragged past the opposite edge gives a negative size and mirrors the layer, as Figma flips it.
 * The edges the handle leaves stay where they are on the canvas, whatever the layer's angle.
 */
export function placeInResizedFrame(
  placement: SelectionPlacement,
  from: Rect,
  to: Rect
): LayerPlacement {
  const { node, world, parentWorld } = placement
  const width = Math.abs(to.width)
  const height = Math.abs(to.height)
  const mirrorX = to.width < 0
  const mirrorY = to.height < 0
  const turned = node.rotation !== 0 || node.flipX || node.flipY
  if (!turned && !mirrorX && !mirrorY) {
    return { x: to.x, y: to.y, width, height, rotation: 0, flipX: false, flipY: false }
  }
  const placed = Matrix.multiply(
    Matrix.multiply(world, Matrix.translated(to.x - from.x, to.y - from.y)),
    Matrix.scaled(mirrorX ? -1 : 1, mirrorY ? -1 : 1)
  )
  const local = localTransformFromWorld({ ...node, width, height }, placed, parentWorld)
  if (!local)
    return { ...to, width, height, rotation: node.rotation, flipX: node.flipX, flipY: node.flipY }
  // Unmirrored, the angle and flips stay exactly as they were; only the position follows.
  return mirrorX || mirrorY
    ? { ...local, width, height }
    : {
        x: local.x,
        y: local.y,
        width,
        height,
        rotation: node.rotation,
        flipX: node.flipX,
        flipY: node.flipY
      }
}

/**
 * Where a layer lands, in its parent's space, when a multi-selection turns `degrees` about a
 * canvas pivot, as Figma rotates a selection about its bounds' center: the layer's center swings
 * around the pivot and the layer itself turns by the same angle on the canvas.
 */
export function placeRotatedAbout(
  placement: SelectionPlacement,
  pivot: Vector,
  degrees: number
): { x: number; y: number; rotation: number } {
  const { node, center, direction, parentInverse } = placement
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = center.x - pivot.x
  const dy = center.y - pivot.y
  const target = { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos }
  const turned = node.rotation + degrees * direction
  const rotation = ((((turned + 180) % 360) + 360) % 360) - 180
  return { ...positionCenteredAt({ ...node, rotation }, parentInverse, target), rotation }
}
