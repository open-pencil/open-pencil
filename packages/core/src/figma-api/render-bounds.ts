import { getWorldMatrix, type SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  geometryBlobBounds,
  intersectVisualBounds,
  strokeOverflow,
  unionVisualBounds,
  type VisualBounds
} from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

const INTRINSIC_CONTAINER_TYPES = new Set([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SECTION'
])

function aabb(points: number[]): VisualBounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < points.length; index += 2) {
    minX = Math.min(minX, points[index])
    minY = Math.min(minY, points[index + 1])
    maxX = Math.max(maxX, points[index])
    maxY = Math.max(maxY, points[index + 1])
  }
  return { minX, minY, maxX, maxY }
}

function transformedRect(
  node: SceneNode,
  graph: SceneGraph,
  x: number,
  y: number,
  width: number,
  height: number
): VisualBounds {
  return aabb(
    Matrix.mapPoints(getWorldMatrix(node, graph), [
      x,
      y,
      x + width,
      y,
      x + width,
      y + height,
      x,
      y + height
    ])
  )
}

function hasRenderableGeometry(node: SceneNode): boolean {
  if (INTRINSIC_CONTAINER_TYPES.has(node.type)) return true
  if (node.type === 'GROUP') return false
  if (node.type === 'TEXT') return node.text.length > 0 && node.fills.some((fill) => fill.visible)
  if (node.fills.some((fill) => fill.visible) || node.strokes.some((stroke) => stroke.visible)) {
    return true
  }
  return node.fillGeometry.length > 0 || node.strokeGeometry.length > 0
}

function translatedBounds(bounds: VisualBounds, offset: Vector, overflow: number): VisualBounds {
  return {
    minX: bounds.minX + offset.x - overflow,
    minY: bounds.minY + offset.y - overflow,
    maxX: bounds.maxX + offset.x + overflow,
    maxY: bounds.maxY + offset.y + overflow
  }
}

function ownRenderBounds(node: SceneNode, graph: SceneGraph): VisualBounds | null {
  if (!hasRenderableGeometry(node)) return null

  const base = transformedRect(node, graph, 0, 0, node.width, node.height)
  const stroke = strokeOverflow(node.strokes)
  let bounds = transformedRect(
    node,
    graph,
    -stroke,
    -stroke,
    node.width + stroke * 2,
    node.height + stroke * 2
  )
  const localGeometry = geometryBlobBounds([...node.fillGeometry, ...node.strokeGeometry])
  if (localGeometry) {
    bounds =
      unionVisualBounds(
        bounds,
        transformedRect(
          node,
          graph,
          localGeometry.x,
          localGeometry.y,
          localGeometry.width,
          localGeometry.height
        )
      ) ?? bounds
  }

  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW') {
      bounds =
        unionVisualBounds(
          bounds,
          translatedBounds(base, effect.offset, effect.radius * 3 + effect.spread)
        ) ?? bounds
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') {
      bounds = translatedBounds(bounds, { x: 0, y: 0 }, effect.radius + effect.spread)
    }
  }
  return bounds
}

function effectiveClip(node: SceneNode, graph: SceneGraph): VisualBounds | null | undefined {
  let clip: VisualBounds | null | undefined
  let current: SceneNode | undefined = node
  while (current) {
    if (!current.visible || current.opacity <= 0) return null
    if (
      current.id !== node.id &&
      current.clipsContent &&
      (current.type === 'FRAME' || current.type === 'COMPONENT' || current.type === 'INSTANCE')
    ) {
      const currentClip = transformedRect(current, graph, 0, 0, current.width, current.height)
      clip = clip ? intersectVisualBounds(clip, currentClip) : currentClip
      if (!clip) return null
    }
    current = current.parentId ? graph.getNode(current.parentId) : undefined
  }
  return clip
}

function groupRenderBounds(node: SceneNode, graph: SceneGraph): VisualBounds | null {
  let bounds: VisualBounds | null = null
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    const childBounds = computeAbsoluteRenderBounds(graph, child)
    if (!childBounds) continue
    bounds = unionVisualBounds(bounds, {
      minX: childBounds.x,
      minY: childBounds.y,
      maxX: childBounds.x + childBounds.width,
      maxY: childBounds.y + childBounds.height
    })
  }
  return bounds
}

/** Return Figma-compatible rendered bounds, or null when the node paints no visible pixels. */
export function computeAbsoluteRenderBounds(graph: SceneGraph, node: SceneNode): Rect | null {
  const clip = effectiveClip(node, graph)
  if (clip === null) return null

  const visual =
    node.type === 'GROUP' ? groupRenderBounds(node, graph) : ownRenderBounds(node, graph)
  const clipped = visual && clip ? intersectVisualBounds(visual, clip) : visual
  if (!clipped || clipped.maxX <= clipped.minX || clipped.maxY <= clipped.minY) return null
  return {
    x: clipped.minX,
    y: clipped.minY,
    width: clipped.maxX - clipped.minX,
    height: clipped.maxY - clipped.minY
  }
}
