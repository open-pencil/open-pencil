import Matrix, { type Mat3 } from '@open-pencil/core/canvas/matrix'

import type { SceneGraph, SceneNode, Vector } from '@open-pencil/core'

export function getWorldMatrix(node: SceneNode, graph: SceneGraph): Mat3 {
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
export function getNodeLocalMatrix(n: SceneNode) {
  const rad = (n.rotation * Math.PI) / 180

  const cx = n.width / 2
  const cy = n.height / 2

  const sx = n.flipX ? -1 : 1
  const sy = n.flipY ? -1 : 1

  let m = Matrix.identity()

  // local translation (relative to parent)
  m = Matrix.multiply(m, Matrix.translated(n.x, n.y))

  // pivot to center
  m = Matrix.multiply(m, Matrix.translated(cx, cy))

  if (n.flipX || n.flipY) {
    m = Matrix.multiply(m, Matrix.scaled(sx, sy))
  }

  // rotate around center
  if (n.rotation) {
    m = Matrix.multiply(m, Matrix.rotated(rad, 0, 0))
  }

  // pivot back
  m = Matrix.multiply(m, Matrix.translated(-cx, -cy))

  return m
}
export function getNodeWorldBounds(node: SceneNode) {
  const m = getNodeLocalMatrix(node)

  const points = Matrix.mapPoints(m, [0, 0, node.width, 0, node.width, node.height, 0, node.height])

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i]
    const y = points[i + 1]

    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

export function getWorldHandles(node: SceneNode, graph: SceneGraph) {
  const matrix = getWorldMatrix(node, graph)

  const w = node.width
  const h = node.height

  const localPts = [
    0,
    0, // nw
    w / 2,
    0, // n
    w,
    0, // ne
    w,
    h / 2, // e
    w,
    h, // se
    w / 2,
    h, // s
    0,
    h, // sw
    0,
    h / 2 // w
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
