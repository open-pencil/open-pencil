import type { Canvas, Path, PathBuilder, PathOp } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { getTextOutlineSupport } from '#core/text/outlines'
import { isOpenVectorNetwork } from '#core/vector/connectivity'
import { addOpenSegmentsToPath } from '#core/vector/path-helpers'

import { sharedPath } from './paths/shared'
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

function unitedPath(r: SkiaRenderer, regions: Path[]): Path | null {
  let merged = regions[0].copy()
  for (let index = 1; index < regions.length; index++) {
    const union = r.ck.Path.MakeFromOp(merged, regions[index], r.ck.PathOp.Union)
    merged.delete()
    if (!union) {
      return null
    }
    merged = union
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
  return sharedPath(r.nodePaths, `${node.id}|saved-fill`, 'united', regions, () =>
    unitedPath(r, regions)
  )
}

function networkRegionsPath(r: SkiaRenderer, node: SceneNode): Path | null {
  if ((node.vectorNetwork?.regions.length ?? 0) < 2) {
    return null
  }
  const regions = r.getVectorPaths(node)
  if (!regions || regions.length === 0) {
    return null
  }
  return sharedPath(r.nodePaths, `${node.id}|network-fill`, 'united', regions, () =>
    unitedPath(r, regions)
  )
}

function savedFillShape(r: SkiaRenderer, node: SceneNode): Path | null {
  return fillGeometryPath(r, node) ?? networkRegionsPath(r, node)
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
  return joinedPath(r, network)
}

function joinedPath(r: SkiaRenderer, parts: Path[]): Path {
  const path = new r.ck.PathBuilder()
  for (const part of parts) {
    path.addPath(part)
  }
  const joined = path.detachAndDelete()
  const fillType = parts[0].getFillType()
  if (parts.every((part) => part.getFillType().value === fillType.value)) {
    joined.setFillType(fillType)
  }
  return joined
}

interface VectorStrokeSides {
  fill: Path
  regions: Path
  looseSegments: Path | null
}

function addVectorStrokeOutlines(
  r: SkiaRenderer,
  target: PathBuilder,
  outline: Path,
  node: SceneNode,
  fill: Path
): void {
  const regionCount = node.vectorNetwork?.regions.length ?? 0
  const parts = regionCount > 0 ? r.getVectorPaths(node) : null
  if (!parts || parts.length <= regionCount) {
    addVisibleStrokeOutlines(r, target, outline, node, {
      fill,
      regions: outline,
      looseSegments: null
    })
    return
  }
  const regions = joinedPath(r, parts.slice(0, regionCount))
  addVisibleStrokeOutlines(r, target, outline, node, {
    fill,
    regions,
    looseSegments: parts[regionCount]
  })
  regions.delete()
}

export function nodeHasVisibleFill(node: SceneNode): boolean {
  return node.fills.some((fill) => fill.visible)
}

export function nodeHasVisibleStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => stroke.visible && stroke.weight > 0)
}

/**
 * Figma shapes a boolean operand by the paints that draw, visible and above 0%: a fill gives its
 * area and each stroke its band. An operand none of whose paints draw gives its area (live-verified).
 */
function drawsPaint(paint: Fill | Stroke): boolean {
  return paint.visible && paint.opacity > 0
}

function drawsFill(node: SceneNode): boolean {
  return node.fills.some(drawsPaint)
}

function drawsStroke(node: SceneNode): boolean {
  return node.strokes.some((stroke) => drawsPaint(stroke) && stroke.weight > 0)
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
  addVisibleStrokeOutlines(r, builder, source, node, null)
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
  vectorSides: VectorStrokeSides | null
): void {
  for (const stroke of node.strokes) {
    if (!drawsPaint(stroke) || stroke.weight <= 0) continue
    const side = strokeSide(node, stroke)
    if (vectorSides && side !== 'CENTER') {
      addSidedVectorStroke(r, target, node, stroke.weight, side, vectorSides)
      continue
    }
    addOwnedPath(target, strokeArea(r, source, stroke.weight, side))
  }
}

function addSidedVectorStroke(
  r: SkiaRenderer,
  target: PathBuilder,
  node: SceneNode,
  weight: number,
  side: Stroke['align'],
  sides: VectorStrokeSides
): void {
  addOwnedPath(target, vectorStrokeArea(r, sides.regions, node, weight, side, sides.fill))
  if (sides.looseSegments) {
    addOwnedPath(target, strokeArea(r, sides.looseSegments, weight, 'CENTER'))
  }
}

function addFilledArea(r: SkiaRenderer, target: PathBuilder, path: Path): void {
  const winding =
    path.getFillType().value === r.ck.FillType.EvenOdd.value ? path.makeAsWinding() : null
  if (!winding) {
    target.addPath(path)
    return
  }
  addOwnedPath(target, winding)
}

function addOwnedPath(target: PathBuilder, path: Path | null): void {
  if (!path) {
    return
  }
  target.addPath(path)
  path.delete()
}

function vectorStrokeArea(
  r: SkiaRenderer,
  source: Path,
  node: SceneNode,
  weight: number,
  side: Stroke['align'],
  filledShape: Path
): Path | null {
  return sharedPath(
    r.nodePaths,
    `${node.id}|aligned|${weight}|${side}`,
    `band|${weight}|${side}`,
    [source, filledShape],
    () => strokeArea(r, source, weight, side, filledShape)
  )
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

/**
 * A frame, group, component or instance gives a boolean operation, or Flatten, only its children's
 * shapes: Figma leaves its own fill and stroke out (live-verified).
 */
function containerSourcePath(r: SkiaRenderer, node: SceneNode, graph: SceneGraph): Path | null {
  const path = new r.ck.PathBuilder()
  const childPaths = appendVisibleChildPaths(
    graph,
    node,
    path,
    (child) => makeBooleanSourcePath(r, child, graph),
    true
  )
  if (!childPaths) {
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

  const savedFill = node.type === 'VECTOR' ? savedFillShape(r, node) : null
  const stroked = drawsStroke(node)
  if (savedFill && !stroked) {
    return savedFill
  }
  const outline = strokeSourcePath(r, node)
  if (!outline) {
    savedFill?.delete()
    return null
  }
  if (!stroked) {
    return outline
  }
  const combined = new r.ck.PathBuilder()
  if (drawsFill(node)) {
    addFilledArea(r, combined, savedFill ?? outline)
  }
  if (node.type === 'VECTOR') {
    addVectorStrokeOutlines(r, combined, outline, node, savedFill ?? outline)
  } else {
    addVisibleStrokeOutlines(r, combined, outline, node, null)
  }
  savedFill?.delete()
  outline.delete()
  return combined.detachAndDelete()
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  const transformed = new r.ck.PathBuilder()
  transformed.addPath(path, getNodeLocalMatrix(child))
  const fillType = path.getFillType()
  path.delete()
  const result = transformed.detachAndDelete()
  result.setFillType(fillType)
  return result
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
  const operands: Path[] = []
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) {
      continue
    }
    const path = transformedShapePath(r, child, graph)
    if (path) {
      operands.push(path)
    }
  }
  if (operands.length === 0) {
    return fillGeometryPath(r, node)
  }
  const signature = `${node.booleanOperation ?? 'UNION'}|${node.cornerRadius}`
  const result = sharedPath(
    r.nodePaths,
    `${node.id}|boolean|${signature}`,
    `boolean|${signature}`,
    operands,
    () => combinedOperands(r, node, operands)
  )
  deletePaths(operands)
  return result ?? fillGeometryPath(r, node)
}

function deletePaths(paths: Path[]): void {
  for (const path of paths) {
    path.delete()
  }
}

function combinedOperands(r: SkiaRenderer, node: SceneNode, operands: Path[]): Path | null {
  const operation = operationForNode(r, node)
  let result = operands[0].copy()
  for (let index = 1; index < operands.length; index++) {
    const combined = r.ck.Path.MakeFromOp(result, operands[index], operation)
    result.delete()
    if (!combined) {
      return null
    }
    result = combined
  }
  if (node.cornerRadius <= 0) {
    return result
  }
  const rounded = withRoundedCorners(r, result, node.cornerRadius)
  result.delete()
  return rounded
}

function withRoundedCorners(r: SkiaRenderer, path: Path, radius: number): Path {
  const { vertices, segments, regions } = parseSVGPath(path.toSVGString(), 'NONZERO', {
    includeOpenRegions: true
  })
  const rounded = new r.ck.PathBuilder()
  for (const region of regions) {
    for (const loop of region.loops) {
      const contour = loop.map((index) => segments[index])
      addOpenSegmentsToPath(rounded, contour, vertices, radius)
    }
  }
  const result = rounded.detachAndDelete()
  result.setFillType(path.getFillType())
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
