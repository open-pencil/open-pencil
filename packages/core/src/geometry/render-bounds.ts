import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import {
  effectOverflow,
  geometryBlobBounds,
  intersectVisualBounds,
  strokeOverflow,
  textDecorationOverflow,
  unionVisualBounds,
  type VisualBounds,
  widestBlurRadius
} from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import { textLinesOverflow } from '@open-pencil/scene-graph/text'

import { mayHoldEmoji } from '#core/text/emoji'
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

function grown(bounds: VisualBounds, by: number): VisualBounds {
  return {
    minX: bounds.minX - by,
    minY: bounds.minY - by,
    maxX: bounds.maxX + by,
    maxY: bounds.maxY + by
  }
}

/**
 * Whether a node paints anything of its own, as Figma's render bounds count it: a text paints
 * with a visible fill or stroke, or an emoji, which draws apart from its fills. A container's box
 * counts whether it paints or not (`withBox`), but only its paint casts its effects.
 */
function paints(node: SceneNode): boolean {
  if (node.type === 'GROUP') return false
  const painted =
    node.fills.some((fill) => fill.visible) || node.strokes.some((stroke) => stroke.visible)
  if (node.type === 'TEXT') return node.text.length > 0 && (painted || mayHoldEmoji(node.text))
  // A vector without a path draws nothing, whatever its paints.
  if (
    node.type === 'VECTOR' &&
    !node.vectorNetwork?.vertices.length &&
    node.fillGeometry.length === 0 &&
    node.strokeGeometry.length === 0
  ) {
    return false
  }
  return painted || node.fillGeometry.length > 0 || node.strokeGeometry.length > 0
}

/**
 * What a node draws before strokes and effects, in its own axes: a text's glyphs where their ink
 * is known (`measureTextInk`), and its box otherwise, with the lines and decoration a fixed-size
 * box lets run past it. `null` for a text that draws no glyph.
 */
function ownShape(node: SceneNode): VisualBounds | null {
  const ink = measureTextInk(node)
  if (ink !== undefined) return ink
  return {
    minX: 0,
    minY: 0,
    maxX: node.width,
    maxY: node.height + textLinesOverflow(node) + textDecorationOverflow(node)
  }
}

/**
 * What a node paints itself, in its own axes: its shape grown by its strokes, with its path
 * geometry, before its effects. With `figma` reach, `null` for a node that paints nothing of its
 * own, as Figma counts it; with `drawn` reach every layer's box counts.
 */
function ownPaint(node: SceneNode, reach: EffectReach): VisualBounds | null {
  if (reach === 'figma' && !paints(node)) return null
  const shape = ownShape(node)
  if (!shape) return null
  const drawn = grown(shape, strokeOverflow(node.strokes, node.strokeCap, node.vectorNetwork, node))
  const outside = node.strokes.some((stroke) => stroke.visible && stroke.align !== 'INSIDE')
  const geometry = geometryBlobBounds([
    ...node.fillGeometry,
    ...(outside ? node.strokeGeometry : [])
  ])
  if (!geometry) return drawn
  return (
    unionVisualBounds(drawn, {
      minX: geometry.x,
      minY: geometry.y,
      maxX: geometry.x + geometry.width,
      maxY: geometry.y + geometry.height
    }) ?? drawn
  )
}

/**
 * `bounds`, in a frame `matrix` maps a node's axes into, swept by the box `reach` spans in those
 * axes: where content moved by any offset inside it lands.
 */
function swept(bounds: VisualBounds, matrix: Mat3, reach: VisualBounds): VisualBounds {
  const linear = [matrix[0], matrix[1], 0, matrix[3], matrix[4], 0, 0, 0, 1]
  const by = mapVisualBounds(linear, reach)
  return {
    minX: bounds.minX + by.minX,
    minY: bounds.minY + by.minY,
    maxX: bounds.maxX + by.maxX,
    maxY: bounds.maxY + by.maxY
  }
}

/**
 * What a node's effects make of `content`, everything it and its children draw, in the frame
 * `matrix` maps its axes into. With `figma` reach, a drop shadow is the content moved by its
 * offset and grown by its radius and spread, and a layer blur grows it by its radius (Figma
 * desktop 126); with `drawn` reach the content grows as far as drawing the effects reaches.
 */
function withEffects(
  node: SceneNode,
  content: VisualBounds,
  matrix: Mat3,
  reach: EffectReach
): VisualBounds {
  if (reach === 'drawn') {
    const { left, top, right, bottom } = effectOverflow(node.effects)
    return swept(content, matrix, { minX: -left, minY: -top, maxX: right, maxY: bottom })
  }
  let bounds = content
  for (const effect of node.effects) {
    if (!effect.visible) continue
    if (effect.type === 'DROP_SHADOW') {
      const by = effect.radius + effect.spread
      const { x, y } = effect.offset
      const shadow = swept(content, matrix, {
        minX: x - by,
        minY: y - by,
        maxX: x + by,
        maxY: y + by
      })
      bounds = unionVisualBounds(bounds, shadow) ?? bounds
    } else if (effect.type === 'LAYER_BLUR' || effect.type === 'FOREGROUND_BLUR') {
      const by = widestBlurRadius(effect)
      bounds = swept(bounds, matrix, { minX: -by, minY: -by, maxX: by, maxY: by })
    }
  }
  return bounds
}

/**
 * What a node draws itself, in its own axes before position, rotation, and flips, its effects
 * included and its children not.
 */
export function localRenderBounds(node: SceneNode, reach: EffectReach): VisualBounds | null {
  const own = ownPaint(node, reach)
  return own && withEffects(node, own, Matrix.identity(), reach)
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

function clipped(bounds: VisualBounds | null, clip: VisualBounds | null): VisualBounds | null {
  return bounds && clip ? intersectVisualBounds(bounds, clip) : bounds
}

/**
 * What a node and its descendants draw, in the frame `matrix` maps the node's axes into, held to
 * `clip`; `null` when nothing does. A node's effects act on everything it draws, its children's
 * included, as Figma casts a group's shadow from its layers. A container that clips its content
 * holds its children to its box; with `drawn` reach its box, counted for every layer, already
 * holds them.
 */
function drawnSubtree(
  graph: SceneGraph,
  node: SceneNode,
  matrix: Mat3,
  clip: VisualBounds | null,
  options: RenderBoundsOptions
): VisualBounds | null {
  const { reach, preview } = options
  const own = ownPaint(node, reach)
  let content = own && mapVisualBounds(matrix, own)
  if (!(reach === 'drawn' && clipsChildren(node))) {
    const box = clipsChildren(node)
      ? mapVisualBounds(matrix, { minX: 0, minY: 0, maxX: node.width, maxY: node.height })
      : null
    const childClip = box && clip ? intersectVisualBounds(box, clip) : (box ?? clip)
    if (!(box && !childClip)) {
      for (const childId of node.childIds) {
        const child = graph.getNode(childId)
        if (!child || !draws(child, reach)) continue
        const local = getNodeLocalMatrix(projectedNode(child, preview))
        const drawn = drawnSubtree(graph, child, Matrix.multiply(matrix, local), childClip, options)
        if (drawn) content = unionVisualBounds(content, drawn)
      }
    }
  }
  const drawn = content && withEffects(node, content, matrix, reach)
  return clipped(withBox(node, drawn, matrix, reach), clip)
}

/**
 * `bounds` with a container's box, which Figma counts in its render bounds even where it paints
 * nothing, and casts no effect from (Figma desktop 126).
 */
function withBox(
  node: SceneNode,
  bounds: VisualBounds | null,
  matrix: Mat3,
  reach: EffectReach
): VisualBounds | null {
  if (reach === 'drawn' || !PAINTING_CONTAINERS.has(node.type)) return bounds
  const box = mapVisualBounds(matrix, { minX: 0, minY: 0, maxX: node.width, maxY: node.height })
  return unionVisualBounds(bounds, box)
}

/**
 * What a node and its descendants draw, in the frame `toFrame` maps the node's own axes into;
 * `null` when nothing does (`drawnSubtree`).
 */
export function subtreeRenderBounds(
  graph: SceneGraph,
  node: SceneNode,
  toFrame: Mat3,
  options: RenderBoundsOptions
): VisualBounds | null {
  return drawnSubtree(graph, node, toFrame, null, options)
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
 * subtree's render bounds with `figma` reach, each part held to the boxes of the ancestors that
 * clip it. `null` when it draws nothing there (Figma desktop 126).
 */
export function absoluteRenderBounds(graph: SceneGraph, node: SceneNode): VisualBounds | null {
  const clip = ancestorClip(graph, node)
  if (clip === null) return null
  const bounds = drawnSubtree(graph, node, getWorldMatrix(node, graph), clip ?? null, {
    reach: 'figma'
  })
  return bounds && bounds.maxX > bounds.minX && bounds.maxY > bounds.minY ? bounds : null
}
