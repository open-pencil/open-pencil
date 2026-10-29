import type { Canvas, Paint, Path } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { polygonOutline, type PolygonOutlineCommand } from '@open-pencil/scene-graph/polygon'
import { shapeWithTextGeometry } from '@open-pencil/scene-graph/shape-with-text'

import { isWholeArc } from '#core/geometry'
import { vectorNetworkToPath, geometryBlobToPath } from '#core/vector'

import { traceSmoothRect } from './paths/smooth-corners'
import type { SkiaRenderer } from './renderer'

export function nodeHasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

export function nodeHasSmoothCorners(node: SceneNode): boolean {
  if (!(node.cornerSmoothing > 0)) return false
  if (node.independentCorners) {
    return (
      node.topLeftRadius > 0 ||
      node.topRightRadius > 0 ||
      node.bottomRightRadius > 0 ||
      node.bottomLeftRadius > 0
    )
  }
  return node.cornerRadius > 0
}

export function makeSmoothRRectPath(r: SkiaRenderer, node: SceneNode, spread = 0): Path {
  const path = new r.ck.PathBuilder()
  const left = 0 - spread
  const top = 0 - spread
  const right = node.width + spread
  const bottom = node.height + spread
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) {
    path.addRect(r.ck.LTRBRect(left, top, Math.max(left, right), Math.max(top, bottom)))
    return path.detachAndDelete()
  }

  if (!traceSmoothRect(path, node, { left, top, right, bottom }, spread)) {
    path.addRect(r.ck.LTRBRect(left, top, right, bottom))
  }
  return path.detachAndDelete()
}

/**
 * A layer's outline as Skia draws it fastest: its box, its rounded box, its oval, or paths. Paths
 * the renderer caches are borrowed; the rest are `owned` and freed by `withNodeOutline`.
 */
export type NodeOutline =
  | { kind: 'rect'; rect: Float32Array }
  | { kind: 'rrect'; rrect: Float32Array }
  | { kind: 'oval'; rect: Float32Array }
  | { kind: 'paths'; paths: readonly Path[]; owned: boolean }

/**
 * `path` grown by `spread`, or shrunk when it is negative, by a round-joined ring around it. Null
 * when Skia cannot build the ring.
 */
function pathWithSpread(r: SkiaRenderer, path: Path, spread: number): Path | null {
  if (spread === 0) return path.copy()
  const ring = path.makeStroked({ width: Math.abs(spread) * 2, join: r.ck.StrokeJoin.Round })
  if (!ring) return null
  const result = r.ck.Path.MakeFromOp(
    path,
    ring,
    spread > 0 ? r.ck.PathOp.Union : r.ck.PathOp.Difference
  )
  ring.delete()
  return result
}

/** `paths` grown by `spread` as an outline that owns them: borrowed ones are copied. */
function pathsOutline(
  r: SkiaRenderer,
  paths: readonly (Path | null)[],
  spread: number,
  owned: boolean
): NodeOutline {
  const present = paths.filter((path): path is Path => path !== null)
  if (spread === 0) return { kind: 'paths', paths: present, owned }
  const grown = present.map((path) => pathWithSpread(r, path, spread))
  if (owned) for (const path of present) path.delete()
  return { kind: 'paths', paths: grown.filter((path): path is Path => path !== null), owned: true }
}

/**
 * The outline a layer fills and clips to, grown by `spread`: saved fill geometry first, as Figma
 * gave it, then an arc, a polygon, star, or shape with text, a vector's paths, and a box with its
 * corners. Boxes and ovals grow as boxes and ovals; paths grow by a round-joined ring.
 */
function nodeOutline(r: SkiaRenderer, node: SceneNode, spread: number): NodeOutline {
  // `0 - spread` rather than `-spread`: a spread of 0 must not put -0 into flattened geometry.
  const rect = r.ck.LTRBRect(0 - spread, 0 - spread, node.width + spread, node.height + spread)
  switch (node.type) {
    case 'VECTOR': {
      const paths = r.getFillGeometry(node) ?? r.getVectorPaths(node) ?? []
      return pathsOutline(r, paths, spread, false)
    }
    case 'ELLIPSE': {
      const geometry = r.getFillGeometry(node)
      if (geometry) return pathsOutline(r, geometry, spread, false)
      if (node.arcData) return pathsOutline(r, [makeArcPath(r, node)], spread, true)
      return { kind: 'oval', rect }
    }
    case 'POLYGON':
    case 'STAR':
    case 'SHAPE_WITH_TEXT':
      return pathsOutline(r, [makePolygonPath(r, node)], spread, true)
    default:
      if (nodeHasSmoothCorners(node)) {
        return { kind: 'paths', paths: [makeSmoothRRectPath(r, node, spread)], owned: true }
      }
      if (nodeHasRadius(node)) return { kind: 'rrect', rrect: makeRRectWithSpread(r, node, spread) }
      return { kind: 'rect', rect }
  }
}

/** Runs `use` with the layer's outline grown by `spread`, then frees the paths it built for it. */
export function withNodeOutline<T>(
  r: SkiaRenderer,
  node: SceneNode,
  use: (outline: NodeOutline) => T,
  spread = 0
): T {
  const outline = nodeOutline(r, node, spread)
  try {
    return use(outline)
  } finally {
    if (outline.kind === 'paths' && outline.owned) for (const path of outline.paths) path.delete()
  }
}

export function drawOutline(canvas: Canvas, outline: NodeOutline, paint: Paint): void {
  switch (outline.kind) {
    case 'rect':
      canvas.drawRect(outline.rect, paint)
      return
    case 'rrect':
      canvas.drawRRect(outline.rrect, paint)
      return
    case 'oval':
      canvas.drawOval(outline.rect, paint)
      return
    case 'paths':
      for (const path of outline.paths) canvas.drawPath(path, paint)
  }
}

/** `outline` as one path the caller owns. */
function outlineToPath(r: SkiaRenderer, outline: NodeOutline): Path {
  if (outline.kind === 'paths' && outline.paths.length === 1) return outline.paths[0].copy()
  const path = new r.ck.PathBuilder()
  if (outline.kind === 'rect') path.addRect(outline.rect)
  else if (outline.kind === 'rrect') path.addRRect(outline.rrect)
  else if (outline.kind === 'oval') path.addOval(outline.rect)
  else for (const source of outline.paths) path.addPath(source)
  return path.detachAndDelete()
}

/** The layer's outline grown by `spread`, as one path the caller owns. */
export function makeNodeShapePath(r: SkiaRenderer, node: SceneNode, spread = 0): Path {
  return withNodeOutline(r, node, (outline) => outlineToPath(r, outline), spread)
}

function outlinePath(r: SkiaRenderer, commands: PolygonOutlineCommand[]): Path {
  const path = new r.ck.PathBuilder()
  for (const command of commands) {
    if (command.type === 'M') path.moveTo(command.x, command.y)
    else if (command.type === 'L') path.lineTo(command.x, command.y)
    else if (command.type === 'C')
      path.cubicTo(command.x1, command.y1, command.x2, command.y2, command.x, command.y)
    else path.close()
  }
  return path.detachAndDelete()
}

/**
 * The polygon or star with its corner radius and smoothing, as Figma draws it, or the outline of
 * a shape with text.
 */
export function makePolygonPath(r: SkiaRenderer, node: SceneNode): Path {
  if (node.type === 'SHAPE_WITH_TEXT') {
    return outlinePath(
      r,
      shapeWithTextGeometry(node.shapeWithTextType, node.width, node.height, node.cornerRadius)
        .outline
    )
  }
  return outlinePath(r, polygonOutline(node))
}

/** A shape with text's stroke-only inner lines, such as a database's front rim, if it has any. */
export function makeShapeWithTextDetailsPath(r: SkiaRenderer, node: SceneNode): Path | null {
  if (node.type !== 'SHAPE_WITH_TEXT') return null
  const { details } = shapeWithTextGeometry(node.shapeWithTextType, node.width, node.height)
  return details.length > 0 ? outlinePath(r, details) : null
}

export function makeRRect(r: SkiaRenderer, node: SceneNode): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      0,
      0,
      node.width,
      node.height,
      node.topLeftRadius,
      node.topLeftRadius,
      node.topRightRadius,
      node.topRightRadius,
      node.bottomRightRadius,
      node.bottomRightRadius,
      node.bottomLeftRadius,
      node.bottomLeftRadius
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(0, 0, node.width, node.height),
    node.cornerRadius,
    node.cornerRadius
  )
}

export function makeRRectWithSpread(
  r: SkiaRenderer,
  node: SceneNode,
  spread: number
): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      0 - spread,
      0 - spread,
      node.width + spread,
      node.height + spread,
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread)
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(0 - spread, 0 - spread, node.width + spread, node.height + spread),
    Math.max(0, node.cornerRadius + spread),
    Math.max(0, node.cornerRadius + spread)
  )
}

export function clipNodeShape(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  withNodeOutline(r, node, (outline) => {
    const op = r.ck.ClipOp.Intersect
    if (outline.kind === 'rect') canvas.clipRect(outline.rect, op, true)
    else if (outline.kind === 'rrect') canvas.clipRRect(outline.rrect, op, true)
    else if (outline.kind === 'paths' && outline.paths.length === 1) {
      canvas.clipPath(outline.paths[0], op, true)
    } else {
      const path = outlineToPath(r, outline)
      canvas.clipPath(path, op, true)
      path.delete()
    }
  })
}

export function getVectorPaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.nodePaths.vector.get(node.id)
  if (cached) return cached
  const paths = vectorNetworkToPath(r.ck, node.vectorNetwork, node.cornerRadius)
  r.nodePaths.store(r.nodePaths.vector, node.id, paths)
  return paths
}

export function getFillGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.fillGeometry.length === 0) return null
  const cached = r.nodePaths.fillGeometry.get(node.id)
  if (cached) return cached
  const paths = node.fillGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.nodePaths.store(r.nodePaths.fillGeometry, node.id, paths)
  return paths
}

export function getStrokeGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.strokeGeometry.length === 0) return null
  const cached = r.nodePaths.strokeGeometry.get(node.id)
  if (cached) return cached
  const paths = node.strokeGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.nodePaths.store(r.nodePaths.strokeGeometry, node.id, paths)
  return paths
}

export function makeArcPath(r: SkiaRenderer, node: SceneNode) {
  const arc = node.arcData
  if (!arc) return null
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2
  const innerRx = rx * arc.innerRadius
  const innerRy = ry * arc.innerRadius

  const startDeg = arc.startingAngle * (180 / Math.PI)
  const endDeg = arc.endingAngle * (180 / Math.PI)
  const sweepDeg = endDeg - startDeg

  const path = new r.ck.PathBuilder()
  const oval = r.ck.LTRBRect(0, 0, node.width, node.height)

  const isFullCircle = isWholeArc(arc)
  if (arc.innerRadius > 0) {
    const innerOval = r.ck.LTRBRect(cx - innerRx, cy - innerRy, cx + innerRx, cy + innerRy)
    if (isFullCircle) {
      // Two loops wound in opposite directions, so the hole stays empty under nonzero fill. A
      // full-turn `addArc` from an angle off the axes draws nothing.
      path.addOval(oval, false)
      path.addOval(innerOval, true)
    } else {
      // One outline whose ends run straight across the ring; `addArc` would start a new contour
      // for each edge and close them on their chords.
      path.arcToOval(oval, startDeg, sweepDeg, true)
      path.arcToOval(innerOval, startDeg + sweepDeg, -sweepDeg, false)
    }
    path.close()
    return path.detachAndDelete()
  }

  if (isFullCircle) {
    path.addOval(oval)
  } else {
    path.moveTo(cx, cy)
    path.arcToOval(oval, startDeg, sweepDeg, false)
    path.close()
  }
  return path.detachAndDelete()
}
