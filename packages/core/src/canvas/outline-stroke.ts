import type { Path } from 'canvaskit-wasm'
import { omit, pick } from 'es-toolkit/object'

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix, localTransformFromWorld } from '@open-pencil/scene-graph/coordinate'
import { copyFills } from '@open-pencil/scene-graph/copy'
import Matrix from '@open-pencil/scene-graph/matrix'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import {
  baseShapePath,
  canContainFlattenableChildren,
  canMakeBooleanSourcePath,
  makeBooleanOperationPath,
  nodeHasVisibleFill,
  nodeHasVisibleStroke,
  placedPath,
  strokeAreaPath,
  windingRuleOf
} from './boolean'
import type { SkiaRenderer } from './renderer'
import { textGlyphPaths } from './text/outlines'

/**
 * A layer Outline stroke makes in place of another: a vector, or for text a group holding one
 * vector per glyph. Placement is in the original layer's parent.
 */
export interface OutlinePiece {
  type: 'VECTOR' | 'GROUP'
  props: Partial<SceneNode>
  children: Partial<SceneNode>[]
}

/** What a layer becomes: its fill as a shape of its own, if it has one, under its stroke. */
export interface OutlinedLayer {
  fill: OutlinePiece | null
  stroke: OutlinePiece
}

/** What the outlines keep of the layer they replace, as Figma's do. */
const KEPT_FIELDS = [
  'opacity',
  'blendMode',
  'effects',
  'visible',
  'locked',
  'horizontalConstraint',
  'verticalConstraint',
  'layoutPositioning'
] as const

/** A layer's strokes as fills, which paint what the strokes painted. */
function strokePaints(node: SceneNode): Fill[] {
  return node.strokes.map((stroke) =>
    omit(stroke, ['weight', 'align', 'cap', 'join', 'dashPattern'])
  )
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

function boundsOf(paths: readonly Path[]): Box | null {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const path of paths) {
    const [l, t, r, b] = path.getBounds()
    left = Math.min(left, l)
    top = Math.min(top, t)
    right = Math.max(right, r)
    bottom = Math.max(bottom, b)
  }
  if (!(right > left) || !(bottom > top)) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** A path as a vector network, moved so `box` starts at the origin. */
function networkIn(r: SkiaRenderer, path: Path, box: Box): SceneNode['vectorNetwork'] {
  const moved = placedPath(r, path, r.ck.Matrix.translated(-box.x, -box.y))
  const network = parseSVGPath(moved.toSVGString(), windingRuleOf(r, moved))
  moved.delete()
  return network
}

/**
 * A box of the layer's own axes as a layer in its parent: turned and mirrored with the layer, so
 * the outline lies where the layer drew it.
 */
function placedLike(node: SceneNode, box: Box): Partial<SceneNode> {
  const world = Matrix.multiply(getNodeLocalMatrix(node), Matrix.translated(box.x, box.y))
  const sized = { ...node, type: 'VECTOR' as const, width: box.width, height: box.height }
  const placement = localTransformFromWorld(sized, world, Matrix.identity())
  return { ...placement, width: box.width, height: box.height }
}

/**
 * Paths in the layer's own axes as what replaces it: one vector, or for text a group of glyph
 * vectors named `childName`. Null when the paths cover nothing.
 */
function pieceOf(
  r: SkiaRenderer,
  node: SceneNode,
  paths: readonly Path[],
  name: string,
  childName: string,
  fills: Fill[]
): OutlinePiece | null {
  const box = boundsOf(paths)
  if (!box) return null
  const props = { ...structuredClone(pick(node, KEPT_FIELDS)), ...placedLike(node, box), name }
  if (node.type !== 'TEXT') {
    const [path] = paths
    return {
      type: 'VECTOR',
      props: { ...props, fills: copyFills(fills), vectorNetwork: networkIn(r, path, box) },
      children: []
    }
  }
  const children = paths.flatMap((path) => {
    const own = boundsOf([path])
    if (!own) return []
    return [
      {
        name: childName,
        x: own.x - box.x,
        y: own.y - box.y,
        width: own.width,
        height: own.height,
        fills: copyFills(fills),
        vectorNetwork: networkIn(r, path, own)
      }
    ]
  })
  return { type: 'GROUP', props, children }
}

/** The shapes a layer is drawn from: text by glyph, anything else as one path. */
function sourcePaths(r: SkiaRenderer, node: SceneNode, graph: SceneGraph): Path[] {
  if (node.type === 'TEXT') return textGlyphPaths(r, node) ?? []
  // A boolean is drawn as the shape its operation makes of its children.
  const path =
    node.type === 'BOOLEAN_OPERATION'
      ? makeBooleanOperationPath(r, node, graph)
      : baseShapePath(r, node)
  return path ? [path] : []
}

/** Whether Outline stroke turns this layer itself into outlines. */
export function canOutlineStroke(node: SceneNode): boolean {
  return canMakeBooleanSourcePath(node) && nodeHasVisibleStroke(node)
}

/**
 * A layer's stroke as Figma's Outline stroke leaves it: "<name> (Stroke)", filled with the
 * stroke's paints where the stroke is drawn, over "<name>", its fill, when it has one. Both keep
 * the layer's turn, opacity, and effects. Null when the stroke covers nothing.
 */
export function outlineStrokeLayer(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): OutlinedLayer | null {
  if (!canOutlineStroke(node)) return null
  const sources = sourcePaths(r, node, graph)
  try {
    // A line's shape is already its stroke.
    const strokes =
      node.type === 'LINE'
        ? sources.map((path) => path.copy())
        : sources.flatMap((path) => strokeAreaPath(r, path, node) ?? [])
    const stroke = pieceOf(r, node, strokes, `${node.name} (Stroke)`, 'Stroke', strokePaints(node))
    for (const path of strokes) path.delete()
    if (!stroke) return null
    const fill =
      node.type !== 'LINE' && nodeHasVisibleFill(node)
        ? pieceOf(r, node, sources, node.name, 'Vector', node.fills)
        : null
    return { fill, stroke }
  } finally {
    for (const path of sources) path.delete()
  }
}

/**
 * The layers Outline stroke turns into outlines: each selected layer with a stroke, and inside a
 * selected group or frame every stroked layer it holds, the frame keeping its own stroke, as in
 * Figma. An instance's layers belong to its component and are left alone.
 */
export function layersToOutline(
  selected: readonly SceneNode[],
  graph: Pick<SceneGraph, 'getChildren'>
): SceneNode[] {
  const found = new Map<string, SceneNode>()
  const visit = (node: SceneNode, selectedItself: boolean) => {
    if (!node.visible && !selectedItself) return
    if (canContainFlattenableChildren(node)) {
      if (node.type === 'INSTANCE') return
      for (const child of graph.getChildren(node.id)) visit(child, false)
      return
    }
    if (canOutlineStroke(node)) found.set(node.id, node)
  }
  for (const node of selected) visit(node, true)
  return [...found.values()]
}
