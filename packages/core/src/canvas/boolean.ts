import type { Canvas, Path, PathOp } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke, WindingRule } from '@open-pencil/scene-graph'
import { getNodeLocalMatrix } from '@open-pencil/scene-graph/coordinate'
import type { GroupFitOptions } from '@open-pencil/scene-graph/group-bounds'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'

import { getTextOutlineSupport } from '#core/text/outlines'
import { isOpenVectorNetwork } from '#core/vector/connectivity'
import { addOpenSegmentsToPath } from '#core/vector/path-helpers'

import { clearFillShader } from './fills'
import { sharedPath } from './paths/shared'
import type { SkiaRenderer } from './renderer'
import {
  configureStrokePaint,
  forVisibleStrokes,
  normalizeDashPattern,
  withStrokeDash
} from './strokes'
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
  return merged
}

function fillGeometryPath(r: SkiaRenderer, node: SceneNode): Path | null {
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
  pieces: Path[],
  outline: Path,
  node: SceneNode,
  fill: Path
): void {
  const regionCount = node.vectorNetwork?.regions.length ?? 0
  const parts = regionCount > 0 ? r.getVectorPaths(node) : null
  if (!parts || parts.length <= regionCount) {
    addVisibleStrokeOutlines(r, pieces, outline, node, {
      fill,
      regions: outline,
      looseSegments: null
    })
    return
  }
  const regions = joinedPath(r, parts.slice(0, regionCount))
  addVisibleStrokeOutlines(r, pieces, outline, node, {
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
  return area
}

/** The area every visible stroke of `node` paints along `source`, or null when none paints. */
export function strokeAreaPath(r: SkiaRenderer, source: Path, node: SceneNode): Path | null {
  const pieces: Path[] = []
  addVisibleStrokeOutlines(r, pieces, source, node, null)
  const path = unitedPieces(r, pieces)
  if (path && !path.isEmpty()) return path
  path?.delete()
  return null
}

function addVisibleStrokeOutlines(
  r: SkiaRenderer,
  pieces: Path[],
  source: Path,
  node: SceneNode,
  vectorSides: VectorStrokeSides | null
): void {
  for (const stroke of node.strokes) {
    if (!drawsPaint(stroke) || stroke.weight <= 0) continue
    const side = strokeSide(node, stroke)
    if (vectorSides && side !== 'CENTER') {
      addSidedVectorStroke(r, pieces, node, stroke.weight, side, vectorSides)
      continue
    }
    keepPiece(pieces, strokeArea(r, source, stroke.weight, side))
  }
}

function addSidedVectorStroke(
  r: SkiaRenderer,
  pieces: Path[],
  node: SceneNode,
  weight: number,
  side: Stroke['align'],
  sides: VectorStrokeSides
): void {
  keepPiece(pieces, vectorStrokeArea(r, sides.regions, node, weight, side, sides.fill))
  if (sides.looseSegments) {
    keepPiece(pieces, strokeArea(r, sides.looseSegments, weight, 'CENTER'))
  }
}

function addStrokePieces(
  r: SkiaRenderer,
  pieces: Path[],
  outline: Path,
  node: SceneNode,
  fill: Path
): void {
  if (node.type === 'VECTOR') {
    addVectorStrokeOutlines(r, pieces, outline, node, fill)
  } else {
    addVisibleStrokeOutlines(r, pieces, outline, node, null)
  }
}

function keepPiece(pieces: Path[], path: Path | null): void {
  if (path) {
    pieces.push(path)
  }
}

// A union op reads each piece's own fill rule; concatenating them under one rule fills their holes.
function unitedPieces(r: SkiaRenderer, pieces: Path[]): Path | null {
  if (pieces.length <= 1) {
    return pieces[0] ?? null
  }
  const united = unitedPath(r, pieces)
  deletePaths(pieces)
  return united
}

function operandPath(r: SkiaRenderer, node: SceneNode, pieces: Path[]): Path | null {
  if (pieces.length <= 1) {
    return pieces[0] ?? null
  }
  const united = sharedPath(r.nodePaths, `${node.id}|operand`, 'operand', pieces, () =>
    unitedPath(r, pieces)
  )
  deletePaths(pieces)
  return united
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

/**
 * A frame, group, component or instance gives a boolean operation, or Flatten, only its children's
 * shapes: Figma leaves its own fill and stroke out (live-verified).
 */
function containerSourcePath(r: SkiaRenderer, node: SceneNode, graph: SceneGraph): Path | null {
  const pieces: Path[] = []
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child || !child.visible) continue
    const childPath = transformedShapePath(r, child, graph)
    if (!childPath) {
      deletePaths(pieces)
      return null
    }
    pieces.push(childPath)
  }
  return operandPath(r, node, pieces)
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
  const fill = savedFill ?? outline
  const pieces = drawsFill(node) ? [fill.copy()] : []
  addStrokePieces(r, pieces, outline, node, fill)
  savedFill?.delete()
  outline.delete()
  return operandPath(r, node, pieces)
}

function transformedShapePath(r: SkiaRenderer, child: SceneNode, graph: SceneGraph): Path | null {
  const path = makeBooleanSourcePath(r, child, graph)
  if (!path) return null
  const placed = placedPath(r, path, getNodeLocalMatrix(child))
  path.delete()
  return placed
}

/** `path` moved by `matrix`; a builder drops the fill rule, so it is set back. */
export function placedPath(r: SkiaRenderer, path: Path, matrix: number[]): Path {
  const builder = new r.ck.PathBuilder()
  builder.addPath(path, matrix)
  const placed = builder.detachAndDelete()
  placed.setFillType(path.getFillType())
  return placed
}

export function windingRuleOf(r: SkiaRenderer, path: Path): WindingRule {
  return path.getFillType().value === r.ck.FillType.EvenOdd.value ? 'EVENODD' : 'NONZERO'
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
        clearFillShader(r)
      }
    }
    between?.()

    // Each stroke resolves its own binding and shader, with its cap, join, and dash, as a shape's.
    forVisibleStrokes(r, node, graph, (stroke, color) => {
      configureStrokePaint(r, node, stroke, color)
      withStrokeDash(r, normalizeDashPattern(stroke.dashPattern), 0, () =>
        drawAlignedStroke(r, canvas, path, stroke)
      )
    })
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
