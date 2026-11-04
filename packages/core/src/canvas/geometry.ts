import type { Path, PathBuilder } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'

import { isOpenVectorNetwork } from '#core/vector/connectivity'

import { baseShapePath, makeBooleanOperationPath, strokeSourcePath } from './boolean'
import { appendVerb, forEachVerb } from './paths/verbs'
import type { SkiaRenderer } from './renderer'
import { nodeHasRadius } from './shapes'
import { getStrokeCapEntity, getStrokeJoinEntity, normalizeDashPattern } from './strokes'
import { makeLineSegmentPath } from './strokes/line'
import { dashPath } from './strokes/outlined-dashes'
import { sideStrokeRRects, type SideWeights } from './strokes/sides'

// The geometry Figma's plugin API reports for a layer (`fillGeometry`, `strokeGeometry`), in the
// layer's own box. Measured in Figma desktop 126.

/**
 * The outline of what a layer fills: its shape whatever its fills, a boolean's result, or each
 * region of a vector. Lines and open vectors fill nothing.
 */
export function fillGeometryPaths(r: SkiaRenderer, graph: SceneGraph, node: SceneNode): Path[] {
  if (node.type === 'LINE') return []
  if (node.type === 'BOOLEAN_OPERATION') {
    const result = makeBooleanOperationPath(r, node, graph)
    return result ? [result] : []
  }
  if (node.type === 'VECTOR') {
    const network = node.vectorNetwork
    if (network && isOpenVectorNetwork(network)) return []
    const regions = r.getVectorPaths(node)
    if (regions && regions.length > 0) return regions.map((region) => region.copy())
  }
  const shape = baseShapePath(r, node)
  return shape ? [shape] : []
}

/**
 * The band each visible stroke of a layer paints, centred on its edge: as wide as the stroke when
 * centred, and twice as wide when inside or outside, which Figma leaves for the fill to clip.
 * Null when no stroke paints.
 */
export function strokeGeometryPath(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode
): Path | null {
  const builder = new r.ck.PathBuilder()
  let painted = false
  for (const stroke of node.strokes) {
    // A side of its own weight paints whatever the stroke's weight says.
    if (!stroke.visible || (!node.independentStrokeWeights && stroke.weight <= 0)) continue
    const band = strokeBand(r, graph, node, stroke)
    if (!band) continue
    builder.addPath(band)
    band.delete()
    painted = true
  }
  const path = builder.detachAndDelete()
  if (painted) return path
  path.delete()
  return null
}

/** The path a stroke follows: a line's segment, a boolean's result, or the layer's own edge. */
function strokeSource(r: SkiaRenderer, graph: SceneGraph, node: SceneNode): Path | null {
  if (node.type === 'LINE') return makeLineSegmentPath(r, node)
  if (node.type === 'BOOLEAN_OPERATION') return makeBooleanOperationPath(r, node, graph)
  return strokeSourcePath(r, node)
}

function strokeBand(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  stroke: Stroke
): Path | null {
  const network = node.type === 'VECTOR' ? node.vectorNetwork : null
  const pattern = normalizeDashPattern(stroke.dashPattern)
  const centred = stroke.align === 'CENTER' || (network !== null && isOpenVectorNetwork(network))
  const scale = centred ? 1 : 2
  const source = strokeSource(r, graph, node)
  if (!source) return null
  const options = (width: number) => ({
    width,
    cap: getStrokeCapEntity(r, stroke.cap ?? node.strokeCap),
    join: getStrokeJoinEntity(r, stroke.join ?? node.strokeJoin),
    miter_limit: node.strokeMiterLimit
  })
  try {
    if (node.independentStrokeWeights) {
      const ring = sidesBand(r, node, scale)
      if (!ring || pattern.length === 0) return ring
      const dashes = dashedSides(r, node, scale, (line, width) =>
        dashPath(r, line, pattern, options(width), false)
      )
      // Rounded corners: the straight dashes are kept within the ring the corners round off.
      const band =
        dashes && nodeHasRadius(node)
          ? r.ck.Path.MakeFromOp(dashes, ring, r.ck.PathOp.Intersect)
          : dashes
      if (band !== dashes) dashes?.delete()
      ring.delete()
      return band
    }
    const width = options(stroke.weight * scale)
    return pattern.length > 0
      ? dashedContours(r, source, pattern, width)
      : source.makeStroked(width)
  } finally {
    source.delete()
  }
}

/** `source` dashed contour by contour, each from its own start, as Figma dashes each loop. */
function dashedContours(
  r: SkiaRenderer,
  source: Path,
  pattern: readonly number[],
  options: Parameters<Path['makeStroked']>[0]
): Path | null {
  const builder = new r.ck.PathBuilder()
  for (const { path, closed } of contours(r, source)) {
    const dashes = dashPath(r, path, pattern, options, closed)
    path.delete()
    if (!dashes) continue
    builder.addPath(dashes)
    dashes.delete()
  }
  return builder.detachAndDelete()
}

/** Each contour of `source` as a path of its own, and whether it closes. */
function contours(r: SkiaRenderer, source: Path): { path: Path; closed: boolean }[] {
  const found: { path: Path; closed: boolean }[] = []
  let current: { builder: PathBuilder; closed: boolean } | null = null
  const finish = () => {
    if (current) found.push({ path: current.builder.detachAndDelete(), closed: current.closed })
    current = null
  }
  forEachVerb(r.ck, source, (verb, a) => {
    if (verb === r.ck.MOVE_VERB) {
      finish()
      current = { builder: new r.ck.PathBuilder(), closed: false }
    }
    if (!current) return
    if (verb === r.ck.CLOSE_VERB) current.closed = true
    appendVerb(r.ck, current.builder, verb, a)
  })
  finish()
  return found
}

/**
 * The dashes of a rectangle's sides of their own weights, as Figma builds them: each side dashed
 * along its own line at its own width, and a square at each corner whose two sides are stroked.
 */
function dashedSides(
  r: SkiaRenderer,
  node: SceneNode,
  scale: number,
  dashesAlong: (line: Path, width: number) => Path | null
): Path | null {
  const [top, right, bottom, left] = [
    node.borderTopWeight,
    node.borderRightWeight,
    node.borderBottomWeight,
    node.borderLeftWeight
  ].map((weight) => weight * scale)
  const { width: w, height: h } = node
  const sides: [number, number, number, number, number][] = [
    [top, 0, 0, w, 0],
    [right, w, 0, w, h],
    [bottom, w, h, 0, h],
    [left, 0, h, 0, 0]
  ]
  const builder = new r.ck.PathBuilder()
  for (const [width, x0, y0, x1, y1] of sides) {
    if (width <= 0) continue
    const line = new r.ck.PathBuilder()
    line.moveTo(x0, y0)
    line.lineTo(x1, y1)
    const path = line.detachAndDelete()
    const dashes = dashesAlong(path, width)
    path.delete()
    if (!dashes) continue
    builder.addPath(dashes)
    dashes.delete()
  }
  const corners: [number, number, number, number][] = [
    [left, top, 0, 0],
    [right, top, w, 0],
    [right, bottom, w, h],
    [left, bottom, 0, h]
  ]
  for (const [across, along, x, y] of corners) {
    if (across <= 0 || along <= 0) continue
    // The square outside the corner that neither side's own line reaches.
    const dx = x === 0 ? -across / 2 : across / 2
    const dy = y === 0 ? -along / 2 : along / 2
    builder.addRect(
      r.ck.LTRBRect(
        Math.min(x, x + dx),
        Math.min(y, y + dy),
        Math.max(x, x + dx),
        Math.max(y, y + dy)
      )
    )
  }
  return builder.detachAndDelete()
}

/**
 * A rectangle's stroke whose sides have their own weights: the ring between its two edges, or
 * null when no side has a weight.
 */
function sidesBand(r: SkiaRenderer, node: SceneNode, scale: number): Path | null {
  const weights: SideWeights = [
    node.borderTopWeight * scale,
    node.borderRightWeight * scale,
    node.borderBottomWeight * scale,
    node.borderLeftWeight * scale
  ]
  if (weights.every((weight) => weight <= 0)) return null
  const { outer, inner } = sideStrokeRRects(node, 'CENTER', 0, weights)
  const builder = new r.ck.PathBuilder()
  builder.addRRect(outer)
  const outside = builder.detachAndDelete()
  if (!inner) return outside
  const hole = new r.ck.PathBuilder()
  hole.addRRect(inner)
  const inside = hole.detachAndDelete()
  const ring = r.ck.Path.MakeFromOp(outside, inside, r.ck.PathOp.Difference)
  outside.delete()
  inside.delete()
  return ring
}
