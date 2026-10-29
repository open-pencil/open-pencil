import type { Canvas, Path, PathBuilder, PathOp } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'

import { getTextOutlineSupport } from '#core/text/outlines'

import type { SkiaRenderer } from './renderer'
import { makeLineStrokeOutline } from './strokes/line'
import { textNodeToOutlinePath } from './text/outlines'

const BOOLEAN_PATH_OP: Record<
  NonNullable<SceneNode['booleanOperation']>,
  'Union' | 'Difference' | 'Intersect' | 'XOR'
> = {
  UNION: 'Union',
  SUBTRACT: 'Difference',
  INTERSECT: 'Intersect',
  EXCLUDE: 'XOR'
}

export function nodePathTransform(r: SkiaRenderer, child: SceneNode): number[] {
  const transforms = [r.ck.Matrix.translated(child.x, child.y)]
  if (child.rotation !== 0) {
    transforms.push(
      r.ck.Matrix.rotated((child.rotation * Math.PI) / 180, child.width / 2, child.height / 2)
    )
  }
  if (child.flipX || child.flipY) {
    transforms.push(
      r.ck.Matrix.scaled(
        child.flipX ? -1 : 1,
        child.flipY ? -1 : 1,
        child.width / 2,
        child.height / 2
      )
    )
  }
  if (transforms.length === 1) return transforms[0]
  return r.ck.Matrix.multiply(...transforms)
}

function hasVisibleImageFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible && fill.type === 'IMAGE')
}

function canMakeTextSourcePath(node: SceneNode): boolean {
  return getTextOutlineSupport(node).supported
}

export function canMakeBooleanSourcePath(node: SceneNode): boolean {
  if (node.type === 'TEXT') return canMakeTextSourcePath(node) && !hasVisibleImageFill(node)
  return node.type !== 'SECTION' && node.type !== 'COMPONENT_SET' && !hasVisibleImageFill(node)
}

export function canMakeBooleanSourceNode(node: SceneNode, graph: SceneGraph): boolean {
  if (!canMakeBooleanSourcePath(node)) return false
  if (!canContainFlattenableChildren(node)) return true
  return node.childIds.every((childId) => {
    const child = graph.getNode(childId)
    return !child || !child.visible || canMakeBooleanSourceNode(child, graph)
  })
}

/** A layer's shape in its own box: its outline, a line's stroke, or text's glyph outlines. */
export function baseShapePath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (node.type === 'TEXT') return textNodeToOutlinePath(r, node)
  if (node.type === 'LINE') return makeLineStrokeOutline(r, node)
  return r.makeNodeShapePath(node)
}

export function nodeHasVisibleFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible)
}

export function nodeHasVisibleStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => stroke.visible && stroke.weight > 0)
}

/**
 * The area a stroke paints along `source`, as the canvas draws it: centred on the path, or, on a
 * layer whose outline it keeps to, twice its weight cut to inside or outside the outline. Vectors
 * stroke their paths centred whatever the alignment, as the canvas draws them.
 */
function strokeArea(r: SkiaRenderer, source: Path, node: SceneNode, stroke: Stroke): Path | null {
  const aligned = stroke.align !== 'CENTER' && node.type !== 'VECTOR'
  const outline = source.makeStroked({ width: aligned ? stroke.weight * 2 : stroke.weight })
  if (!outline || !aligned) return outline
  const op = stroke.align === 'INSIDE' ? r.ck.PathOp.Intersect : r.ck.PathOp.Difference
  const area = r.ck.Path.MakeFromOp(outline, source, op)
  outline.delete()
  // An op's result fills even-odd; turned to non-zero, it keeps its holes when added to others.
  const winding = area?.makeAsWinding() ?? null
  area?.delete()
  return winding
}

/** The area every visible stroke of `node` paints along `source`, or null when none paints. */
export function strokeAreaPath(r: SkiaRenderer, source: Path, node: SceneNode): Path | null {
  const builder = new r.ck.PathBuilder()
  addVisibleStrokeOutlines(r, builder, source, node)
  const path = builder.detachAndDelete()
  if (!path.isEmpty()) return path
  path.delete()
  return null
}

function addVisibleStrokeOutlines(
  r: SkiaRenderer,
  target: PathBuilder,
  source: Path,
  node: SceneNode
): void {
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.weight <= 0) continue
    const area = strokeArea(r, source, node, stroke)
    if (!area) continue
    target.addPath(area)
    area.delete()
  }
}

export function canContainFlattenableChildren(node: SceneNode): boolean {
  return (
    node.type === 'GROUP' ||
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'INSTANCE'
  )
}

function appendVisibleChildPaths(
  r: SkiaRenderer,
  graph: SceneGraph,
  parent: SceneNode,
  target: PathBuilder,
  makeChildPath: (child: SceneNode) => Path | null,
  failOnMissing: boolean
): boolean | null {
  let hasPath = false
  for (const childId of parent.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const childPath = makeChildPath(child)
    if (!childPath) {
      if (failOnMissing) return null
      continue
    }
    target.addPath(childPath, nodePathTransform(r, child))
    childPath.delete()
    hasPath = true
  }
  return hasPath
}

function containerSourcePath(r: SkiaRenderer, node: SceneNode, graph: SceneGraph): Path | null {
  const path = new r.ck.PathBuilder()
  let hasPath = false

  if (nodeHasVisibleFill(node) || nodeHasVisibleStroke(node)) {
    const ownPath = baseShapePath(r, node)
    if (ownPath) {
      if (nodeHasVisibleFill(node)) path.addPath(ownPath)
      addVisibleStrokeOutlines(r, path, ownPath, node)
      ownPath.delete()
      hasPath = true
    }
  }

  const childPaths = appendVisibleChildPaths(
    r,
    graph,
    node,
    path,
    (child) => makeBooleanSourcePath(r, child, graph),
    true
  )
  if (childPaths === null) {
    path.delete()
    return null
  }
  hasPath ||= childPaths

  if (!hasPath) {
    path.delete()
    return null
  }
  return path.detachAndDelete()
}

export function makeBooleanSourcePath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  if (node.type === 'BOOLEAN_OPERATION') return makeBooleanOperationPath(r, node, graph)
  if (!canMakeBooleanSourcePath(node)) return null
  if (canContainFlattenableChildren(node)) return containerSourcePath(r, node, graph)
  if (node.type === 'LINE') return baseShapePath(r, node)

  const path = baseShapePath(r, node)
  if (!path) return null
  if (!nodeHasVisibleStroke(node)) return path
  const combined = new r.ck.PathBuilder()
  combined.addPath(path)
  addVisibleStrokeOutlines(r, combined, path, node)
  path.delete()
  return combined.detachAndDelete()
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  const transformed = new r.ck.PathBuilder()
  transformed.addPath(path, nodePathTransform(r, child))
  path.delete()
  return transformed.detachAndDelete()
}

function operationForNode(r: SkiaRenderer, node: SceneNode): PathOp {
  const operation = node.booleanOperation ?? 'UNION'
  return r.ck.PathOp[BOOLEAN_PATH_OP[operation]]
}

function makeImportedFillGeometryPath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (typeof r.getFillGeometry !== 'function') return null
  const fillGeometry = r.getFillGeometry(node)
  if (!fillGeometry) return null
  const result = new r.ck.PathBuilder()
  for (const path of fillGeometry) result.addPath(path)
  return result.detachAndDelete()
}

export function makeBooleanOperationPath(
  r: SkiaRenderer,
  node: SceneNode,
  graph: SceneGraph
): Path | null {
  const childPaths: Path[] = []
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const path = transformedShapePath(r, child, graph)
    if (path) childPaths.push(path)
  }

  if (childPaths.length === 0) return makeImportedFillGeometryPath(r, node)

  let result = childPaths[0]
  const operation = operationForNode(r, node)
  for (let index = 1; index < childPaths.length; index++) {
    const path = childPaths[index]
    const combined = r.ck.Path.MakeFromOp(result, path, operation)
    result.delete()
    path.delete()
    if (!combined) {
      for (const remaining of childPaths.slice(index + 1)) remaining.delete()
      return makeImportedFillGeometryPath(r, node)
    }
    result = combined
  }
  return result
}

/**
 * Measures boolean operations for the group refit: the tight box of the combined shape in the
 * parent's space, which Figma sizes a boolean to, or null for an empty result, which keeps the
 * operands' box as Figma does.
 */
export function booleanResultBounds(
  r: SkiaRenderer,
  graph: SceneGraph
): NonNullable<GroupFitOptions['booleanBounds']> {
  return (node) => {
    const path = makeBooleanOperationPath(r, node, graph)
    if (!path) return null
    const [left, top, right, bottom] = path.computeTightBounds()
    path.delete()
    if (right <= left && bottom <= top) return null
    return { x: node.x + left, y: node.y + top, width: right - left, height: bottom - top }
  }
}

/** Group refit options that size booleans to their result when a renderer can measure it. */
export function groupFitOptions(r: SkiaRenderer | null, graph: SceneGraph): GroupFitOptions {
  return r ? { booleanBounds: booleanResultBounds(r, graph) } : {}
}

/** Draws the operation's fills and strokes, without its effects. */
export function paintBooleanOperation(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  between?: () => void
): void {
  const path = makeBooleanOperationPath(r, node, graph)
  if (!path) return

  try {
    for (let fillIndex = 0; fillIndex < node.fills.length; fillIndex++) {
      const fill = node.fills[fillIndex]
      if (!fill.visible || !r.applyFill(fill, node, graph, fillIndex)) continue
      r.fillPaint.setAlphaf(fill.opacity)
      try {
        canvas.drawPath(path, r.fillPaint)
      } finally {
        r.fillPaint.setShader(null)
      }
    }
    between?.()

    for (const stroke of node.strokes) {
      if (!stroke.visible) continue
      const color = r.resolveStrokeColor(stroke, 0, node, graph)
      r.strokePaint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
      r.strokePaint.setStrokeWidth(stroke.weight)
      r.strokePaint.setAlphaf(stroke.opacity)
      canvas.drawPath(path, r.strokePaint)
    }
  } finally {
    path.delete()
  }
}

/** Draws a boolean operation with its shadows: inner shadows sit over its fills, under strokes. */
export function renderBooleanOperation(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph
): void {
  r.renderEffects(canvas, node, graph, 'behind')
  paintBooleanOperation(r, canvas, node, graph, () => r.renderEffects(canvas, node, graph, 'inner'))
  r.renderEffects(canvas, node, graph, 'front')
}
