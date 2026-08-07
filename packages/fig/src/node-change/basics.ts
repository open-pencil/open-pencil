import type { SceneNode } from '@open-pencil/scene-graph'
import type { Matrix } from '@open-pencil/scene-graph/primitives'

export function mapToFigmaType(type: SceneNode['type']): string {
  switch (type) {
    case 'FRAME':
      return 'FRAME'
    case 'RECTANGLE':
      return 'RECTANGLE'
    case 'ROUNDED_RECTANGLE':
      return 'ROUNDED_RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'POLYGON':
      return 'REGULAR_POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'BOOLEAN_OPERATION':
      return 'BOOLEAN_OPERATION'
    case 'GROUP':
      return 'FRAME'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'SYMBOL'
    case 'COMPONENT_SET':
      return 'FRAME'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    default:
      return 'RECTANGLE'
  }
}

/** Generate a printable, lexicographically ordered parent position. */
export function fractionalPosition(index: number): string {
  const BASE = 94
  const FIRST = 33
  const TILDE = 126
  const numTildes = Math.floor(index / BASE)
  const lastChar = String.fromCharCode(FIRST + (index % BASE))
  return String.fromCharCode(TILDE).repeat(numTildes) + lastChar
}

export function computeExportTransform(node: SceneNode): Matrix {
  const sx = node.flipX ? -1 : 1
  const cos = Math.cos((node.rotation * Math.PI) / 180)
  const sin = Math.sin((node.rotation * Math.PI) / 180)

  const m00 = cos * sx
  const m01 = -sin
  const m10 = sin * sx
  const m11 = cos

  // This must be the exact inverse of the import decode (convert.ts). For a
  // rotated, unflipped node the decode treats rotation as about the node CENTER
  // (x = m02 - (w/2)(1-cos) - sin(h/2)), so encode the same way — otherwise a
  // rotated node's origin drifts on every export→reimport. The AABB min-corner
  // form below only matches the decode's rotation==0 / flipped branch.
  if (node.rotation !== 0 && !node.flipX) {
    return {
      m00,
      m01,
      m02: node.x + (node.width / 2) * (1 - cos) + sin * (node.height / 2),
      m10,
      m11,
      m12: node.y + (node.height / 2) * (1 - cos) - sin * (node.width / 2)
    }
  }

  const corners = [
    { x: 0, y: 0 },
    { x: node.width, y: 0 },
    { x: 0, y: node.height },
    { x: node.width, y: node.height }
  ].map((point) => ({
    x: m00 * point.x + m01 * point.y,
    y: m10 * point.x + m11 * point.y
  }))
  const offsetX = Math.min(...corners.map((point) => point.x))
  const offsetY = Math.min(...corners.map((point) => point.y))

  return {
    m00,
    m01,
    m02: node.x - offsetX,
    m10,
    m11,
    m12: node.y - offsetY
  }
}
