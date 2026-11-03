import type { Path } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'

import { isOpenVectorNetwork } from '#core/vector/connectivity'

import { baseShapePath, makeBooleanOperationPath, strokeSourcePath } from './boolean'
import type { SkiaRenderer } from './renderer'
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
export function strokeGeometryPath(r: SkiaRenderer, node: SceneNode): Path | null {
  const builder = new r.ck.PathBuilder()
  let painted = false
  for (const stroke of node.strokes) {
    if (!stroke.visible || stroke.weight <= 0) continue
    const band = strokeBand(r, node, stroke)
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

function strokeBand(r: SkiaRenderer, node: SceneNode, stroke: Stroke): Path | null {
  const network = node.type === 'VECTOR' ? node.vectorNetwork : null
  const pattern = normalizeDashPattern(stroke.dashPattern)
  const centred = stroke.align === 'CENTER' || (network !== null && isOpenVectorNetwork(network))
  const scale = centred ? 1 : 2
  if (node.independentStrokeWeights) return sidesBand(r, node, scale)
  const source = node.type === 'LINE' ? makeLineSegmentPath(r, node) : strokeSourcePath(r, node)
  if (!source) return null
  try {
    const options = {
      width: stroke.weight * scale,
      cap: getStrokeCapEntity(r, stroke.cap ?? node.strokeCap),
      join: getStrokeJoinEntity(r, stroke.join ?? node.strokeJoin),
      miter_limit: node.strokeMiterLimit
    }
    return pattern.length > 0 ? dashPath(r, source, pattern, options) : source.makeStroked(options)
  } finally {
    source.delete()
  }
}

/** A rectangle's stroke whose sides have their own weights: the ring between its two edges. */
function sidesBand(r: SkiaRenderer, node: SceneNode, scale: number): Path | null {
  const weights: SideWeights = [
    node.borderTopWeight * scale,
    node.borderRightWeight * scale,
    node.borderBottomWeight * scale,
    node.borderLeftWeight * scale
  ]
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
