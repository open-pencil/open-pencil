import type { Canvas, Path, PathBuilder, PathOp } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'

import { getTextOutlineSupport } from '#core/text/outlines'
import { isOpenVectorNetwork } from '#core/vector/connectivity'

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

function unitedPath(r: SkiaRenderer, regions: Path[]): Path {
  let merged = regions[0].copy()
  for (let index = 1; index < regions.length; index++) {
    const union = r.ck.Path.MakeFromOp(merged, regions[index], r.ck.PathOp.Union)
    if (union) {
      merged.delete()
      merged = union
    }
  }
  const winding = merged.makeAsWinding()
  if (!winding) {
    return merged
  }
  merged.delete()
  return winding
}

function fillGeometryPath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (typeof r.getFillGeometry !== 'function') {
    return null
  }
  const regions = r.getFillGeometry(node)
  if (!regions || regions.length === 0) {
    return null
  }
  return unitedPath(r, regions)
}

function networkRegionsPath(r: SkiaRenderer, node: SceneNode): Path | null {
  if ((node.vectorNetwork?.regions.length ?? 0) < 2) {
    return null
  }
  const regions = r.getVectorPaths(node)
  if (!regions || regions.length === 0) {
    return null
  }
  return unitedPath(r, regions)
}

function cachedFillShape(r: SkiaRenderer, node: SceneNode): Path | null {
  const cached = r.nodePaths.fillShape.get(node.id)
  if (cached) {
    return cached[0]
  }
  const path = fillGeometryPath(r, node) ?? networkRegionsPath(r, node)
  if (path) {
    r.nodePaths.store(r.nodePaths.fillShape, node.id, [path])
  }
  return path
}

/** A layer's shape in its own box: its outline, a line's stroke, or text's glyph outlines. */
export function baseShapePath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (node.type === 'TEXT') return textNodeToOutlinePath(r, node)
  if (node.type === 'LINE') return makeLineStrokeOutline(r, node)
  return r.makeNodeShapePath(node)
}

function strokeSourcePath(r: SkiaRenderer, node: SceneNode): Path | null {
  const network = node.type === 'VECTOR' ? r.getVectorPaths(node) : null
  if (!network || network.length === 0) {
    return baseShapePath(r, node)
  }
  const path = new r.ck.PathBuilder()
  for (const part of network) {
    path.addPath(part)
  }
  return path.detachAndDelete()
}

export function nodeHasVisibleFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible)
}

export function nodeHasVisibleStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => stroke.visible && stroke.weight > 0)
}

function strokeSide(node: SceneNode, stroke: Stroke): Stroke['align'] {
  const network = node.type === 'VECTOR' ? node.vectorNetwork : null
  return network && isOpenVectorNetwork(network) ? 'CENTER' : stroke.align
}

function strokeArea(
  r: SkiaRenderer,
  source: Path,
  weight: number,
  side: Stroke['align'],
  filledShape: Path = source
): Path | null {
  if (side === 'CENTER') {
    return source.makeStroked({ width: weight })
  }
  const band = source.makeStroked({ width: weight * 2 })
  if (!band) {
    return null
  }
  const keptSide = side === 'INSIDE' ? r.ck.PathOp.Intersect : r.ck.PathOp.Difference
  const area = r.ck.Path.MakeFromOp(band, filledShape, keptSide)
  band.delete()
  // An op's result fills even-odd; turned to non-zero, it keeps its holes when added to others.
  const winding = area?.makeAsWinding() ?? null
  area?.delete()
  return winding
}

/** The area every visible stroke of `node` paints along `source`, or null when none paints. */
export function strokeAreaPath(r: SkiaRenderer, source: Path, node: SceneNode): Path | null {
  const builder = new r.ck.PathBuilder()
  addVisibleStrokeOutlines(r, builder, source, node, false)
  const path = builder.detachAndDelete()
  if (!path.isEmpty()) return path
  path.delete()
  return null
}

function addVisibleStrokeOutlines(
  r: SkiaRenderer,
  target: PathBuilder,
  source: Path,
  node: SceneNode,
  reuseVectorAreas: boolean
): void {
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.weight <= 0) continue
    const side = strokeSide(node, stroke)
    if (reuseVectorAreas && node.type === 'VECTOR' && side !== 'CENTER') {
      const cachedArea = cachedVectorStrokeArea(r, source, node, stroke.weight, side)
      if (cachedArea) {
        target.addPath(cachedArea)
      }
      continue
    }
    const area = strokeArea(r, source, stroke.weight, side)
    if (!area) continue
    target.addPath(area)
    area.delete()
  }
}

function cachedVectorStrokeArea(
  r: SkiaRenderer,
  source: Path,
  node: SceneNode,
  weight: number,
  side: Stroke['align']
): Path | null {
  const key = `${node.id}|aligned|${weight}|${side}`
  const cached = r.nodePaths.strokeOutline.get(key)
  if (cached) {
    return cached[0]
  }
  const filledShape = cachedFillShape(r, node) ?? source
  const area = strokeArea(r, source, weight, side, filledShape)
  if (area) {
    r.nodePaths.store(r.nodePaths.strokeOutline, key, [area])
  }
  return area
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
    target.addPath(childPath, getNodeLocalMatrix(child))
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
      addVisibleStrokeOutlines(r, path, ownPath, node, false)
      ownPath.delete()
      hasPath = true
    }
  }

  const childPaths = appendVisibleChildPaths(
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

  const savedFill = node.type === 'VECTOR' ? cachedFillShape(r, node) : null
  const stroked = nodeHasVisibleStroke(node)
  if (savedFill && !stroked) {
    return savedFill.copy()
  }
  const outline = strokeSourcePath(r, node)
  if (!outline) {
    return null
  }
  if (!stroked) {
    return outline
  }
  const combined = new r.ck.PathBuilder()
  if (nodeHasVisibleFill(node)) {
    combined.addPath(savedFill ?? outline)
  }
  addVisibleStrokeOutlines(r, combined, outline, node, node.type === 'VECTOR')
  outline.delete()
  return combined.detachAndDelete()
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  const transformed = new r.ck.PathBuilder()
  transformed.addPath(path, getNodeLocalMatrix(child))
  path.delete()
  return transformed.detachAndDelete()
}

function operationForNode(r: SkiaRenderer, node: SceneNode): PathOp {
  const operation = node.booleanOperation ?? 'UNION'
  return r.ck.PathOp[BOOLEAN_PATH_OP[operation]]
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

  if (childPaths.length === 0) return fillGeometryPath(r, node)

  let result = childPaths[0]
  const operation = operationForNode(r, node)
  for (let index = 1; index < childPaths.length; index++) {
    const path = childPaths[index]
    const combined = r.ck.Path.MakeFromOp(result, path, operation)
    result.delete()
    path.delete()
    if (!combined) {
      for (const remaining of childPaths.slice(index + 1)) remaining.delete()
      return fillGeometryPath(r, node)
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
      r.strokePaint.setAlphaf(stroke.opacity)
      drawAlignedStroke(r, canvas, path, stroke)
    }
  } finally {
    path.delete()
  }
}

function drawAlignedStroke(r: SkiaRenderer, canvas: Canvas, path: Path, stroke: Stroke): void {
  if (stroke.align === 'CENTER') {
    r.strokePaint.setStrokeWidth(stroke.weight)
    canvas.drawPath(path, r.strokePaint)
    return
  }
  const keptSide = stroke.align === 'INSIDE' ? r.ck.ClipOp.Intersect : r.ck.ClipOp.Difference
  canvas.save()
  canvas.clipPath(path, keptSide, true)
  r.strokePaint.setStrokeWidth(stroke.weight * 2)
  canvas.drawPath(path, r.strokePaint)
  canvas.restore()
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
