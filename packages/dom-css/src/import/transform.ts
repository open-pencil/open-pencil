import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  parseCSSTransformOrigin,
  parseCSSTransforms,
  type CSSTransformStyle
} from '@open-pencil/scene-graph/css'
import Matrix from '@open-pencil/scene-graph/matrix'

import type { DesignStyleDeclaration } from '../types'
import { pickStyle } from './css-values'

/** An element's transform properties and the origin they transform about. */
export interface CSSTransform extends CSSTransformStyle {
  origin?: string
}

/** Transforms by the id of the layer built for their element. */
export type CSSTransforms = Map<string, CSSTransform>

/** Differences smaller than this, in pixels or degrees, are rounding. */
const EPSILON = 1e-6

/** The transform an element's style declares, or undefined when it declares none. */
export function cssTransform(style: DesignStyleDeclaration): CSSTransform | undefined {
  const transform: CSSTransform = {
    transform: pickStyle(style, 'transform'),
    translate: pickStyle(style, 'translate'),
    rotate: pickStyle(style, 'rotate'),
    scale: pickStyle(style, 'scale'),
    origin: pickStyle(style, 'transform-origin')
  }
  const declared = [transform.transform, transform.translate, transform.rotate, transform.scale]
  return declared.some((value) => value !== undefined && value.trim() !== 'none')
    ? transform
    : undefined
}

function hasAutoLayout(node: SceneNode): boolean {
  return node.layoutMode !== 'NONE' && node.layoutMode !== 'GRID'
}

/**
 * Turns and moves a laid-out layer as its element's transform does. A layer turns and mirrors
 * about its center, so the transform's turn becomes its rotation, a mirror its flip, and how far
 * it moves its center its offset; scaling and skewing, which a layer cannot hold, are left out.
 * CSS draws a transformed element without moving the others, so a layer that moves out of auto
 * layout takes its parent's auto layout off, which keeps its siblings where they were laid out.
 */
function applyTransform(graph: SceneGraph, node: SceneNode, transform: CSSTransform): void {
  const box = { width: node.width, height: node.height }
  const matrix = parseCSSTransforms(transform, box)
  if (!matrix) return
  const [a, c, , b, d] = matrix
  const flipped = a * d - b * c < 0
  const rotation = (Math.atan2(b, flipped ? -a : a) * 180) / Math.PI
  const origin = parseCSSTransformOrigin(transform.origin, box)
  const center = { x: box.width / 2, y: box.height / 2 }
  const aboutOrigin = Matrix.multiply(
    Matrix.translated(origin.x, origin.y),
    matrix,
    Matrix.translated(-origin.x, -origin.y)
  )
  const moved = Matrix.mapPoint(aboutOrigin, center)
  const dx = moved.x - center.x
  const dy = moved.y - center.y
  if (Math.abs(rotation) > EPSILON) node.rotation = rotation
  if (flipped) node.flipX = !node.flipX
  if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) return
  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  if (parent && hasAutoLayout(parent) && node.layoutPositioning !== 'ABSOLUTE') {
    parent.layoutMode = 'NONE'
  }
  node.x += dx
  node.y += dy
}

/**
 * Applies the elements' transforms to their layers once they are laid out, as CSS transforms
 * elements after it lays them out.
 */
export function applyCSSTransforms(graph: SceneGraph, transforms: CSSTransforms): void {
  for (const [id, transform] of transforms) {
    const node = graph.getNode(id)
    if (node) applyTransform(graph, node, transform)
  }
}
