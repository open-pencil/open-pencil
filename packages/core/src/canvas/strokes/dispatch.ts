import type { Canvas, Path } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  collectArrowEndpoints,
  hasTrimmedShaft,
  trimArrowShafts
} from '@open-pencil/scene-graph/arrow-caps'
import type { Color } from '@open-pencil/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  configureStrokePaint,
  drawArrowHeads,
  forVisibleStrokes,
  getStrokeCapEntity,
  getStrokeJoinEntity,
  normalizeDashPattern,
  withStrokeDash
} from '#core/canvas/strokes'
import { drawIndividualSideStrokes } from '#core/canvas/strokes/sides'
import {
  addStrokeRunToPath,
  strokeRuns,
  vectorNetworkToCenterlinePath,
  vectorNetworkToPath
} from '#core/vector'
import { isOpenVectorNetwork } from '#core/vector/connectivity'

import { drawLineStroke } from './line'
import { drawOutlinedDashes } from './outlined-dashes'
import { drawDashedRectStroke, strokeDashesByOutline, strokeSideWeights } from './sides'

function drawVectorStrokeGeometry(
  r: SkiaRenderer,
  canvas: Canvas,
  sg: Path[],
  sc: Color,
  opacity: number
): void {
  r.fillPaint.setColorComponents(sc.r, sc.g, sc.b, sc.a)
  r.fillPaint.setAlphaf(opacity)
  for (const p of sg) canvas.drawPath(p, r.fillPaint)
}

export function vectorStrokePaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.nodePaths.vectorStroke.get(node.id)
  if (cached) return cached

  // A path per run, so the corners inside a run join and only its open ends take caps.
  const { segments, vertices } = node.vectorNetwork
  const paths = strokeRuns(segments).map((run) => {
    const path = new r.ck.PathBuilder()
    addStrokeRunToPath(path, run, segments, vertices)
    return path.detachAndDelete()
  })

  if (paths.length === 0) return null
  r.nodePaths.store(r.nodePaths.vectorStroke, node.id, paths)
  return paths
}

/** Stroke outlines are cached under `<nodeId>|…`, which `NodePathCaches.invalidate` removes. */
function strokeOutlineKey(
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  source: 'runs' | 'regions' | 'closed' | 'open' | 'trimmed'
): string {
  return `${node.id}|${source}|${stroke.weight}|${stroke.cap ?? node.strokeCap}|${stroke.join ?? node.strokeJoin}|${node.strokeMiterLimit}`
}

function drawVectorPathStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  vectorPaths: Path[],
  stroke: SceneNode['strokes'][0],
  sc: Color,
  miterLimit: number,
  outlineCacheKey?: string
): void {
  const dash = normalizeDashPattern(stroke.dashPattern)
  if (dash.length > 0) {
    r.strokePaint.setColorComponents(sc.r, sc.g, sc.b, sc.a)
    r.strokePaint.setAlphaf(stroke.opacity)
    r.strokePaint.setStrokeWidth(stroke.weight)
    r.strokePaint.setStrokeCap(getStrokeCapEntity(r, stroke.cap ?? 'NONE'))
    r.strokePaint.setStrokeJoin(getStrokeJoinEntity(r, stroke.join ?? 'MITER'))
    r.strokePaint.setStrokeMiter(miterLimit)
    withStrokeDash(r, dash, 0, () => {
      for (const vp of vectorPaths) canvas.drawPath(vp, r.strokePaint)
    })
    return
  }
  const strokeOpts = {
    width: stroke.weight,
    miter_limit: miterLimit,
    cap: getStrokeCapEntity(r, stroke.cap ?? 'NONE'),
    join: getStrokeJoinEntity(r, stroke.join ?? 'MITER')
  }
  r.fillPaint.setColorComponents(sc.r, sc.g, sc.b, sc.a)
  r.fillPaint.setAlphaf(stroke.opacity)

  const cached = outlineCacheKey ? r.nodePaths.strokeOutline.get(outlineCacheKey) : undefined
  if (cached) {
    for (const outline of cached) canvas.drawPath(outline, r.fillPaint)
    return
  }
  const outlines: Path[] = []
  for (const vp of vectorPaths) {
    const outline = vp.makeStroked(strokeOpts)
    if (outline) outlines.push(outline)
  }
  for (const outline of outlines) canvas.drawPath(outline, r.fillPaint)
  // Drawing copies the outline, so one without a cache key is done with here.
  if (outlineCacheKey) r.nodePaths.store(r.nodePaths.strokeOutline, outlineCacheKey, outlines)
  else for (const outline of outlines) outline.delete()
}

/**
 * Draws a dashed stroke on a rectangle, frame, section, or component set with Figma's dash
 * layout, and returns false when the stroke has no dashes or has round or square dash ends on
 * sides of their own weights, which that layout does not cover.
 */
export function drawFigmaDashes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0]
): boolean {
  const dash = normalizeDashPattern(stroke.dashPattern)
  if (dash.length === 0) return false
  if (strokeDashesByOutline(node, stroke)) {
    drawDashedRectStroke(r, canvas, node, stroke, strokeSideWeights(node, stroke), dash)
  } else if (node.independentStrokeWeights) {
    return false
  } else {
    drawOutlinedDashes(r, canvas, node, stroke, dash)
  }
  return true
}

function drawRegularStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  sc: Color
): void {
  configureStrokePaint(r, node, stroke, sc)
  withStrokeDash(r, normalizeDashPattern(stroke.dashPattern), 0, () => {
    if (node.independentStrokeWeights && r.isRectangularType(node.type)) {
      drawIndividualSideStrokes(r, canvas, node, stroke)
    } else if (!r.isRectangularType(node.type) || !drawFigmaDashes(r, canvas, node, stroke)) {
      r.drawStrokeWithAlign(canvas, node, stroke.align)
    }
  })
}

function drawNodeStroke(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  sc: Color,
  sg: Path[] | null,
  vectorPaths: Path[] | null,
  vectorStroke: Path[] | null
): void {
  const shouldStrokeVectorCenterline =
    vectorStroke &&
    stroke.align === 'CENTER' &&
    node.cornerRadius === 0 &&
    node.type === 'VECTOR' &&
    !node.fills.some((fill) => fill.visible)
  if (shouldStrokeVectorCenterline) {
    const outlineKey = strokeOutlineKey(node, stroke, 'runs')
    drawVectorPathStrokes(r, canvas, vectorStroke, stroke, sc, node.strokeMiterLimit, outlineKey)
    return
  }
  if (!sg) {
    if (vectorPaths) drawAlignedVectorPathStrokes(r, canvas, node, vectorPaths, stroke, sc)
    else drawRegularStroke(r, canvas, node, stroke, sc)
    return
  }
  if (node.type === 'VECTOR' && stroke.align !== 'CENTER') {
    drawFillSideStrokeGeometry(r, canvas, node, stroke, sc, sg)
    return
  }
  if (stroke.align !== 'INSIDE') {
    if (node.type === 'VECTOR' || node.type === 'TEXT') {
      drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    } else drawRegularStroke(r, canvas, node, stroke, sc)
    return
  }

  canvas.save()
  r.clipNodeShape(canvas, node)
  drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
  canvas.restore()
}

export function isPathTextWithStrokeGeometry(node: SceneNode): boolean {
  return (
    node.type === 'TEXT' &&
    node.textPathData !== null &&
    (node.derivedTextGlyphs?.length ?? 0) > 0 &&
    node.strokeGeometry.length > 0
  )
}

/**
 * Draws arrow-cap heads for a stroke on a vector's open path ends. Runs after the shaft
 * regardless of which branch painted it, so heads survive fills, non-center alignment, corner
 * radii, and dashed shafts.
 */
function drawNodeArrowHeads(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  color: Color
): void {
  if (node.type !== 'VECTOR' || !node.vectorNetwork) return
  const endpoints = collectArrowEndpoints(node.vectorNetwork, stroke.cap ?? node.strokeCap)
  if (endpoints.length > 0) {
    drawArrowHeads(r, canvas, endpoints, stroke.weight, color, stroke.opacity)
  }
}

export function paintNodeStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  sg: Path[] | null,
  vectorPaths: Path[] | null,
  vectorStroke: Path[] | null
): void {
  forVisibleStrokes(r, node, graph, (stroke, color) => {
    if (node.type === 'LINE') {
      drawLineStroke(r, canvas, node, stroke, color)
      return
    }
    if (
      stroke.dashPattern &&
      stroke.dashPattern.length > 0 &&
      node.type === 'VECTOR' &&
      node.vectorNetwork
    ) {
      const key = `${node.id}|centerline|${node.cornerRadius}`
      let centerline = r.nodePaths.strokeOutline.get(key)
      if (!centerline) {
        centerline = [vectorNetworkToCenterlinePath(r.ck, node.vectorNetwork, node.cornerRadius)]
        r.nodePaths.store(r.nodePaths.strokeOutline, key, centerline)
      }
      drawVectorPathStrokes(r, canvas, centerline, stroke, color, node.strokeMiterLimit)
      drawNodeArrowHeads(r, canvas, node, stroke, color)
      return
    }
    const cap = stroke.cap ?? node.strokeCap
    if (
      !sg &&
      stroke.align === 'CENTER' &&
      node.type === 'VECTOR' &&
      node.vectorNetwork &&
      hasTrimmedShaft(node.vectorNetwork, cap)
    ) {
      // The line stops short of a triangle or equilateral head, so it is stroked from its own
      // pulled-back copy rather than the cached paths; saved stroke geometry is already trimmed.
      const key = `${node.id}|trimmed|${cap}|${stroke.weight}|${node.cornerRadius}`
      let paths = r.nodePaths.strokeOutline.get(key)
      if (!paths) {
        const network = trimArrowShafts(node.vectorNetwork, cap, stroke.weight)
        paths = vectorNetworkToPath(r.ck, network, node.cornerRadius)
        r.nodePaths.store(r.nodePaths.strokeOutline, key, paths)
      }
      drawVectorPathStrokes(
        r,
        canvas,
        paths,
        stroke,
        color,
        node.strokeMiterLimit,
        strokeOutlineKey(node, stroke, 'trimmed')
      )
      drawNodeArrowHeads(r, canvas, node, stroke, color)
      return
    }
    drawNodeStroke(r, canvas, node, stroke, color, sg, vectorPaths, vectorStroke)
    drawNodeArrowHeads(r, canvas, node, stroke, color)
  })
}

/**
 * Strokes a vector's paths on the side its alignment takes, as a shape's stroke is: a centred
 * stroke twice as wide, kept inside its closed regions for `INSIDE` and outside them for
 * `OUTSIDE`. Open segments enclose nothing to take a side of, so they stroke centred.
 */
function drawAlignedVectorPathStrokes(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  vectorPaths: Path[],
  stroke: SceneNode['strokes'][0],
  sc: Color
): void {
  const miter = node.strokeMiterLimit
  // `vectorNetworkToPath` lists a path for each region, then one for the open segments.
  const regions = node.vectorNetwork?.regions.length ?? 0
  const closed = vectorPaths.slice(0, regions)
  const inside = stroke.align === 'INSIDE' && closed.length > 0 ? unitePaths(r, closed) : null
  const sided = clipToStrokeSide(r, canvas, closed, stroke.align, inside)
  inside?.delete()
  if (!sided) {
    const outlineKey = strokeOutlineKey(node, stroke, 'regions')
    drawVectorPathStrokes(r, canvas, vectorPaths, stroke, sc, miter, outlineKey)
    return
  }
  const doubled = { ...stroke, weight: stroke.weight * 2 }
  drawVectorPathStrokes(
    r,
    canvas,
    closed,
    doubled,
    sc,
    miter,
    strokeOutlineKey(node, doubled, 'closed')
  )
  canvas.restore()
  const open = vectorPaths.slice(regions)
  if (open.length > 0)
    drawVectorPathStrokes(
      r,
      canvas,
      open,
      stroke,
      sc,
      miter,
      strokeOutlineKey(node, stroke, 'open')
    )
}

function clipToStrokeSide(
  r: SkiaRenderer,
  canvas: Canvas,
  closed: Path[],
  align: SceneNode['strokes'][0]['align'],
  inside: Path | null
): boolean {
  if (align === 'OUTSIDE' && closed.length > 0) {
    canvas.save()
    for (const path of closed) {
      canvas.clipPath(path, r.ck.ClipOp.Difference, true)
    }
    return true
  }
  if (align !== 'INSIDE' || !inside) {
    return false
  }
  canvas.save()
  canvas.clipPath(inside, r.ck.ClipOp.Intersect, true)
  return true
}

function cachedFillUnion(r: SkiaRenderer, node: SceneNode, fillPaths: Path[]): Path | null {
  const key = `${node.id}|fill-union`
  const cached = r.nodePaths.strokeOutline.get(key)
  if (cached) {
    return cached[0]
  }
  const united = unitePaths(r, fillPaths)
  if (united) {
    r.nodePaths.store(r.nodePaths.strokeOutline, key, [united])
  }
  return united
}

/** One path covering every path given, which a clip can keep the inside of. */
function unitePaths(r: SkiaRenderer, paths: Path[]): Path | null {
  let united: Path | null = paths[0]?.copy() ?? null
  for (const path of paths.slice(1)) {
    if (!united) break
    const next = r.ck.Path.MakeFromOp(united, path, r.ck.PathOp.Union)
    united.delete()
    united = next
  }
  return united
}

function drawFillSideStrokeGeometry(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  stroke: SceneNode['strokes'][0],
  sc: Color,
  sg: Path[]
): void {
  const fillPaths = r.getFillGeometry(node)
  const sideable = fillPaths && !(node.vectorNetwork && isOpenVectorNetwork(node.vectorNetwork))
  const inside = sideable && stroke.align === 'INSIDE' ? cachedFillUnion(r, node, fillPaths) : null
  if (!sideable || !clipToStrokeSide(r, canvas, fillPaths, stroke.align, inside)) {
    drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
    return
  }
  drawVectorStrokeGeometry(r, canvas, sg, sc, stroke.opacity)
  canvas.restore()
}
