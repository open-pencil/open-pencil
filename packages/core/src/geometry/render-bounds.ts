import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import {
  effectOverflow,
  geometryBlobBounds,
  intersectVisualBounds,
  strokeOverflow,
  textDecorationOverflow,
  unionVisualBounds,
  type VisualBounds
} from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { textLinesOverflow } from '@open-pencil/scene-graph/text'

import { measureTextInk } from '#core/text/ink'

import { projectedNode } from './scene'
import type { RotationPreview } from './types'

/**
 * How far effects grow what a node draws: `figma` as Figma's render bounds and exports take them,
 * a shadow by its radius and spread and a blur by its radius; `drawn` as far as drawing them
 * reaches, which a canvas must hold so it clips none of a blur.
 */
export type EffectReach = 'figma' | 'drawn'

interface RenderBoundsOptions {
  reach: EffectReach
  preview?: RotationPreview | null
}

const PAINTING_CONTAINERS = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'])

/** The axis-aligned box around `bounds` once `matrix` maps it. */
export function mapVisualBounds(matrix: Mat3, bounds: VisualBounds): VisualBounds {
  const points = Matrix.mapPoints(matrix, [
    bounds.minX,
    bounds.minY,
    bounds.maxX,
    bounds.minY,
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.maxY
  ])
  const xs = [points[0], points[2], points[4], points[6]]
  const ys = [points[1], points[3], points[5], points[7]]
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  }
}

function grown(bounds: VisualBounds, by: number, x = 0, y = 0): VisualBounds {
  return {
    minX: bounds.minX + x - by,
    minY: bounds.minY + y - by,
    maxX: bounds.maxX + x + by,
    maxY: bounds.maxY + y + by
  }
}

/** Whether a node paints anything of its own, as Figma's render bounds count it. */
function paints(node: SceneNode): boolean {
  if (PAINTING_CONTAINERS.has(node.type)) return true
  if (node.type === 'GROUP') return false
  if (node.type === 'TEXT') return node.text.length > 0 && node.fills.some((fill) => fill.visible)
  // A vector without a path draws nothing, whatever its paints.
  if (
    node.type === 'VECTOR' &&
    !node.vectorNetwork?.vertices.length &&
    node.fillGeometry.length === 0 &&
    node.strokeGeometry.length === 0
  ) {
    return false
  }
  if (node.fills.some((fill) => fill.visible) || node.strokes.some((stroke) => stroke.visible)) {
    return true
  }
  return node.fillGeometry.length > 0 || node.strokeGeometry.length > 0
}

/**
 * What a node draws before strokes and effects, in its own axes: a text's glyphs where their ink
 * is known (`measureTextInk`), and its box otherwise, with the lines and decoration a fixed-size
 * box lets run past it. `null` for a text that draws no glyph.
 */
function ownShape(node: SceneNode): VisualBounds | null {
  const ink = node.type === 'TEXT' && !node.textPathData ? measureTextInk(node) : undefined
  if (ink !== undefined) return ink
  return {
    minX: 0,
    minY: 0,
    maxX: node.width,
    maxY: node.height + textLinesOverflow(node) + textDecorationOverflow(node)
  }
}

/**
 * What a node draws itself, in its own axes before position, rotation, and flips: its shape
 * grown by its strokes, with its path geometry, and then by its effects. Children are not
 * included. With `figma` reach, `null` for a node that paints nothing of its own.
 */
export function localRenderBounds(node: SceneNode, reach: EffectReach): VisualBounds | null {
  if (reach === 'figma' && !paints(node)) return null
  const shape = ownShape(node)
  if (!shape) return null
  let drawn = grown(shape, strokeOverflow(node.strokes, node.strokeCap, node.vectorNetwork, node))
  const outside = node.strokes.some((stroke) => stroke.visible && stroke.align !== 'INSIDE')
  const geometry = geometryBlobBounds([
    ...node.fillGeometry,
    ...(outside ? node.strokeGeometry : [])
  ])
  if (geometry) {
    drawn =
      unionVisualBounds(drawn, {
        minX: geometry.x,
        minY: geometry.y,
        maxX: geometry.x + geometry.width,
        maxY: geometry.y + geometry.height
      }) ?? drawn
  }
  if (reach === 'drawn') {
    const effects = effectOverflow(node.effects)
    return {
      minX: drawn.minX - effects.left,
      minY: drawn.minY - effects.top,
      maxX: drawn.maxX + effects.right,
      maxY: drawn.maxY + effects.bottom
    }
  }
  // A shadow is the stroked shape moved by its offset and grown by its radius and spread; a blur
  // grows it by its radius (Figma desktop 126).
  let bounds = drawn
  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW') {
      const shadow = grown(drawn, effect.radius + effect.spread, effect.offset.x, effect.offset.y)
      bounds = unionVisualBounds(bounds, shadow) ?? bounds
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') {
      bounds = grown(bounds, effect.radius)
    }
  }
  return bounds
}

function clipsChildren(node: SceneNode): boolean {
  return (
    node.clipsContent &&
    (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE')
  )
}

/** Whether a node draws at all: shown, and, as Figma counts it, not fully transparent. */
function draws(node: SceneNode, reach: EffectReach): boolean {
  return node.visible && (reach === 'drawn' || node.opacity > 0)
}

/**
 * What a node and its descendants draw, in the frame `toFrame` maps the node's own axes into;
 * `null` when nothing does. One pass down the subtree composes each child's local matrix, so no
 * node walks its ancestors. A container that clips its content holds its children to its box:
 * with `drawn` reach the walk ends there, since the box, counted for every layer, already holds
 * them.
 */
export function subtreeRenderBounds(
  graph: SceneGraph,
  node: SceneNode,
  toFrame: Mat3,
  { reach, preview }: RenderBoundsOptions
): VisualBounds | null {
  const own = localRenderBounds(node, reach)
  let bounds = own && mapVisualBounds(toFrame, own)
  const pending: Array<{ node: SceneNode; matrix: Mat3; clip: VisualBounds | null }> = [
    { node, matrix: toFrame, clip: null }
  ]
  for (let entry = pending.pop(); entry; entry = pending.pop()) {
    let clip = entry.clip
    if (clipsChildren(entry.node)) {
      if (reach === 'drawn') continue
      const box = mapVisualBounds(entry.matrix, {
        minX: 0,
        minY: 0,
        maxX: entry.node.width,
        maxY: entry.node.height
      })
      clip = clip ? intersectVisualBounds(clip, box) : box
      if (!clip) continue
    }
    for (const childId of entry.node.childIds) {
      const child = graph.getNode(childId)
      if (!child || !draws(child, reach)) continue
      const matrix = Matrix.multiply(
        entry.matrix,
        getNodeLocalMatrix(projectedNode(child, preview))
      )
      const local = localRenderBounds(child, reach)
      const mapped = local && mapVisualBounds(matrix, local)
      const shown = mapped && clip ? intersectVisualBounds(mapped, clip) : mapped
      if (shown) bounds = unionVisualBounds(bounds, shown)
      pending.push({ node: child, matrix, clip })
    }
  }
  return bounds
}

/** The box the node's ancestors clip it to, in page coordinates; `null` when they hide it all. */
function ancestorClip(graph: SceneGraph, node: SceneNode): VisualBounds | null | undefined {
  let clip: VisualBounds | null | undefined
  for (let current = node; ;) {
    if (!draws(current, 'figma')) return null
    const parent = current.parentId ? graph.getNode(current.parentId) : undefined
    if (!parent) return clip
    if (clipsChildren(parent)) {
      const box = mapVisualBounds(getWorldMatrix(parent, graph), {
        minX: 0,
        minY: 0,
        maxX: parent.width,
        maxY: parent.height
      })
      clip = clip ? intersectVisualBounds(clip, box) : box
      if (!clip) return null
    }
    current = parent
  }
}

/**
 * What a node draws on the page, as Figma's `absoluteRenderBounds` and exports take it: its
 * subtree's render bounds with `figma` reach, held to the boxes of the ancestors that clip it.
 * `null` when it draws nothing there (Figma desktop 126).
 */
export function absoluteRenderBounds(graph: SceneGraph, node: SceneNode): VisualBounds | null {
  const clip = ancestorClip(graph, node)
  if (clip === null) return null
  const bounds = subtreeRenderBounds(graph, node, getWorldMatrix(node, graph), { reach: 'figma' })
  const shown = bounds && clip ? intersectVisualBounds(bounds, clip) : bounds
  return shown && shown.maxX > shown.minX && shown.maxY > shown.minY ? shown : null
}
