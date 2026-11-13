import type { SceneNode } from './types'

/** A rectangle's corner radii, clockwise from the top left. */
export type CornerRadii = [
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number
]

type CornerNode = Pick<
  SceneNode,
  | 'width'
  | 'height'
  | 'cornerRadius'
  | 'independentCorners'
  | 'topLeftRadius'
  | 'topRightRadius'
  | 'bottomRightRadius'
  | 'bottomLeftRadius'
>

/** The radii a layer asks for, clockwise from the top left, none below zero. */
export function cornerRadii(node: Omit<CornerNode, 'width' | 'height'>): CornerRadii {
  const radii: CornerRadii = node.independentCorners
    ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
    : [node.cornerRadius, node.cornerRadius, node.cornerRadius, node.cornerRadius]
  return radii.map((radius) => Math.max(0, radius)) as CornerRadii
}

/**
 * The radii a `width` × `height` box draws. An edge whose two corners ask for more than its length
 * scales them by its length over their sum, and each corner takes the tighter of its two edges'
 * scales (Figma desktop, live: 90, 30, 0, 60 in a 100 × 100 box draw 60, 25, 0, 40).
 */
export function fittedCornerRadii(width: number, height: number, radii: CornerRadii): CornerRadii {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii
  const scale = (length: number, a: number, b: number) =>
    a + b > length ? Math.max(0, length) / (a + b) : 1
  const top = scale(width, topLeft, topRight)
  const right = scale(height, topRight, bottomRight)
  const bottom = scale(width, bottomRight, bottomLeft)
  const left = scale(height, bottomLeft, topLeft)
  return [
    topLeft * Math.min(top, left),
    topRight * Math.min(top, right),
    bottomRight * Math.min(right, bottom),
    bottomLeft * Math.min(bottom, left)
  ]
}

/** The radii a layer's corners draw at, fitted to its box. */
export function nodeCornerRadii(node: CornerNode): CornerRadii {
  return fittedCornerRadii(node.width, node.height, cornerRadii(node))
}
