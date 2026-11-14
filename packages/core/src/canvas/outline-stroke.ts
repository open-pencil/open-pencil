import { omit, pick } from 'es-toolkit/object'

import type { Path } from '@open-pencil/canvaskit'
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
import { curvePathData } from './paths/svg-data'
import type { SkiaRenderer } from './renderer'
import { textGlyphPaths, textOutlinePieces, type PaintedPath } from './text/outlines/glyphs'

/**
 * A layer Outline stroke makes in place of another: a vector, or for text a group holding one
 * vector per glyph. Placement is in the original layer's parent.
 */
export interface OutlinePiece {
  type: 'VECTOR' | 'GROUP'
  props: Partial<SceneNode>
  children: Partial<SceneNode>[]
}

/**
 * What a layer becomes: its fill as a shape of its own, if it has one, under its stroke, if it
 * has one; text without a stroke becomes its glyphs alone.
 */
export interface OutlinedLayer {
  fill: OutlinePiece | null
  stroke: OutlinePiece | null
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

/**
 * How the layer fills its auto layout parent, which each outline vector keeps; text's outlines
 * are a group, which Figma sizes fixed (Figma desktop 126).
 */
const FILL_SIZING_FIELDS = ['layoutGrow', 'layoutAlignSelf'] as const

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
  const network = parseSVGPath(curvePathData(r.ck, moved), windingRuleOf(r, moved))
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
 * Paths in the layer's own axes as what replaces it: one vector, or for text a group of vectors
 * named `childName`, one per glyph or decoration in its own paints. Null when they cover nothing.
 */
function pieceOf(
  r: SkiaRenderer,
  node: SceneNode,
  parts: readonly PaintedPath[],
  name: string,
  childName: string
): OutlinePiece | null {
  const box = boundsOf(parts.map(({ path }) => path))
  const first = parts.at(0)
  if (!box || !first) return null
  const props = { ...structuredClone(pick(node, KEPT_FIELDS)), ...placedLike(node, box), name }
  if (node.type !== 'TEXT') {
    const vectorNetwork = networkIn(r, first.path, box)
    return {
      type: 'VECTOR',
      props: {
        ...props,
        ...pick(node, FILL_SIZING_FIELDS),
        fills: copyFills(first.fills),
        vectorNetwork
      },
      children: []
    }
  }
  const children = parts.flatMap(({ path, fills }) => {
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

/**
 * Whether Outline stroke turns this layer itself into outlines: one with a stroke, or one with a
 * fill, which Figma turns into a vector of its fill even without a stroke (Figma desktop 126).
 */
export function canOutlineStroke(node: SceneNode): boolean {
  return canMakeBooleanSourcePath(node) && (nodeHasVisibleStroke(node) || nodeHasVisibleFill(node))
}

/** Where a layer's stroke is drawn, one path per source; a line's shape is already its stroke. */
function strokeOutlines(r: SkiaRenderer, node: SceneNode, sources: readonly Path[]): Path[] {
  if (node.type === 'LINE') return sources.map((path) => path.copy())
  return sources.flatMap((path) => strokeAreaPath(r, path, node) ?? [])
}

/**
 * A layer's stroke as Figma's Outline stroke leaves it: "<name> (Stroke)", filled with the
 * stroke's paints where the stroke is drawn, over "<name>", its fill, when it has one; text's fill
 * is its glyphs, each in its character's fills, with its underlines and strikethroughs. Both keep
 * the layer's turn, opacity, and effects. Null when a shape's stroke covers nothing.
 */
export function outlineStrokeLayer(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): OutlinedLayer | null {
  if (!canOutlineStroke(node)) return null
  const text = node.type === 'TEXT'
  const filled = node.type !== 'LINE' && nodeHasVisibleFill(node)
  const sources = sourcePaths(r, node, graph)
  const glyphs = text && filled ? (textOutlinePieces(r, node) ?? []) : []
  try {
    const strokes = nodeHasVisibleStroke(node) ? strokeOutlines(r, node, sources) : []
    const paints = strokePaints(node)
    const strokeParts = strokes.map((path) => ({ path, fills: paints }))
    const stroke = pieceOf(r, node, strokeParts, `${node.name} (Stroke)`, 'Stroke')
    for (const path of strokes) path.delete()
    // A shape whose stroke covers nothing is left alone; a fill alone is still outlined.
    if (!stroke && nodeHasVisibleStroke(node) && !text) return null
    const fillParts = text ? glyphs : sources.map((path) => ({ path, fills: node.fills }))
    const fill = filled ? pieceOf(r, node, fillParts, node.name, 'Vector') : null
    return fill || stroke ? { fill, stroke } : null
  } finally {
    for (const path of sources) path.delete()
    for (const { path } of glyphs) path.delete()
  }
}

/**
 * The layers Outline stroke turns into outlines: each selected layer with a fill or stroke, and
 * inside a selected group, frame, or component every such layer it shows, the container keeping
 * its own paints, as in Figma. An instance's layers belong to its component and are left alone.
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
