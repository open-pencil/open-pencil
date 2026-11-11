import type { Canvas, ImageFilter, Path, Shader } from '@open-pencil/canvaskit'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'

import { tracePath } from '#core/canvas/paths/verbs'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledProgram } from '#core/canvas/renderer/shaders'
import { makeNodeShapePath, withNodeOutline } from '#core/canvas/shapes'

import { glassGeometryMap } from './map'
import {
  GLASS_LIGHT,
  GLASS_MAX_SEGMENTS,
  GLASS_REFRACTION,
  type GlassOutline,
  glassBackdropSigma,
  glassDepth,
  glassGeometryUniforms,
  glassLightAxis,
  glassParams,
  glassSampleRadius
} from './shader'

/** One piece of an outline: a straight edge, or a cubic to flatten. */
type OutlinePiece = number[]

/**
 * `path`'s outline, closed as a fill closes it, as its straight edges and its cubics: quads and
 * conics arrive as cubics, the way `tracePath` gives them.
 */
function outlinePieces(r: SkiaRenderer, path: Path): OutlinePiece[] {
  const pieces: OutlinePiece[] = []
  let start = [0, 0]
  let at = [0, 0]
  // Adds nothing once the pen is back at the contour's start, so it is safe to call again.
  const closeContour = () => {
    if (at[0] !== start[0] || at[1] !== start[1]) pieces.push([at[0], at[1], start[0], start[1]])
    at = start
  }
  tracePath(r.ck, path, {
    moveTo(x, y) {
      closeContour()
      start = at = [x, y]
    },
    lineTo(x, y) {
      pieces.push([at[0], at[1], x, y])
      at = [x, y]
    },
    cubicTo(x1, y1, x2, y2, x3, y3) {
      pieces.push([at[0], at[1], x1, y1, x2, y2, x3, y3])
      at = [x3, y3]
    },
    close: closeContour
  })
  closeContour()
  return pieces
}

function cubicPoint(c: OutlinePiece, t: number): [number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const d = 3 * u * t * t
  const e = t * t * t
  return [a * c[0] + b * c[2] + d * c[4] + e * c[6], a * c[1] + b * c[3] + d * c[5] + e * c[7]]
}

/** How long a cubic's control polygon runs, an upper bound on its length. */
function controlLength(c: OutlinePiece): number {
  return (
    Math.hypot(c[2] - c[0], c[3] - c[1]) +
    Math.hypot(c[4] - c[2], c[5] - c[3]) +
    Math.hypot(c[6] - c[4], c[7] - c[5])
  )
}

/** Every contour of `path`, closed, as `count` segments evenly spaced along its length. */
function resampledSegments(r: SkiaRenderer, path: Path, count: number): number[] {
  const iter = new r.ck.ContourMeasureIter(path, true, 1)
  const contours = []
  for (let contour = iter.next(); contour; contour = iter.next()) contours.push(contour)
  iter.delete()
  const total = contours.reduce((sum, contour) => sum + contour.length(), 0)
  const segments: number[] = []
  for (const contour of contours) {
    const length = contour.length()
    const steps = Math.max(1, Math.floor(total > 0 ? (count * length) / total : 0))
    let previous = contour.getPosTan(0)
    for (let i = 1; i <= steps && segments.length / 4 < count; i++) {
      const next = contour.getPosTan((length * i) / steps)
      segments.push(previous[0], previous[1], next[0], next[1])
      previous = next
    }
    contour.delete()
  }
  return segments
}

/**
 * `path`'s outline as at most `GLASS_MAX_SEGMENTS` straight segments: its straight edges as they
 * are and its curves split by length into the rest. An outline with more straight edges than that,
 * such as text, is resampled evenly instead.
 */
function flattenedSegments(r: SkiaRenderer, path: Path): Float32Array {
  const pieces = outlinePieces(r, path)
  const lines = pieces.filter((piece) => piece.length === 4)
  const curves = pieces.filter((piece) => piece.length === 8)
  if (lines.length + curves.length > GLASS_MAX_SEGMENTS) {
    return new Float32Array(resampledSegments(r, path, GLASS_MAX_SEGMENTS))
  }
  const spare = GLASS_MAX_SEGMENTS - lines.length - curves.length
  const curveLength = curves.reduce((sum, curve) => sum + controlLength(curve), 0)
  const segments: number[] = []
  for (const piece of pieces) {
    if (piece.length === 4) {
      segments.push(...piece)
      continue
    }
    const steps = 1 + Math.floor(curveLength > 0 ? (spare * controlLength(piece)) / curveLength : 0)
    let previous: [number, number] = [piece[0], piece[1]]
    for (let i = 1; i <= steps; i++) {
      const next = cubicPoint(piece, i / steps)
      segments.push(previous[0], previous[1], next[0], next[1])
      previous = next
    }
  }
  return new Float32Array(segments)
}

/** The outline the glass shaders bend light at: the layer's box, or its outline flattened. */
function glassOutline(r: SkiaRenderer, node: SceneNode, shape: Path | null): GlassOutline {
  const box = (rect: Float32Array, radii: [number, number, number, number]): GlassOutline => ({
    origin: [rect[0], rect[1]],
    size: [rect[2] - rect[0], rect[3] - rect[1]],
    radii,
    isBox: true,
    segments: new Float32Array()
  })
  const flattened = (path: Path): GlassOutline => ({
    origin: [0, 0],
    size: [node.width, node.height],
    radii: [0, 0, 0, 0],
    isBox: false,
    segments: flattenedSegments(r, path)
  })
  if (shape) return flattened(shape)
  return withNodeOutline(r, node, (outline) => {
    if (outline.kind === 'rect') return box(outline.rect, [0, 0, 0, 0])
    if (outline.kind === 'rrect') {
      const rr = outline.rrect
      return box(rr, [rr[4], rr[6], rr[8], rr[10]])
    }
    const path = makeNodeShapePath(r, node)
    try {
      return flattened(path)
    } finally {
      path.delete()
    }
  })
}

/** How a glass shader finds the outline: the uniforms that say so, and the map it reads. */
interface ShapeInputs {
  uniforms: { useMap: number; mapOrigin: [number, number]; mapScale: number }
  map: Shader
  release: () => void
}

/**
 * The geometry map of a non-box outline, which both glass shaders read, or, for a box or when no
 * map can be drawn, a stand-in the shaders never read while they compute the outline instead.
 */
function shapeInputs(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  outline: GlassOutline,
  depth: number
): ShapeInputs {
  const map = glassGeometryMap(r, canvas, node, outline, depth)
  if (map) {
    return {
      uniforms: { useMap: 1, mapOrigin: map.origin, mapScale: map.scale },
      map: map.shader,
      // The renderer's map cache owns the shader.
      release: () => undefined
    }
  }
  const unused = r.ck.Shader.MakeColor(r.ck.TRANSPARENT, r.ck.ColorSpace.SRGB)
  return {
    uniforms: { useMap: 0, mapOrigin: [0, 0], mapScale: 1 },
    map: unused,
    release: () => unused.delete()
  }
}

/** Draws `filter` over what lies behind the layer, inside its outline or inside `shape`. */
function filterBackdrop(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  filter: ImageFilter,
  shape: Path | null
): void {
  canvas.save()
  if (shape) canvas.clipPath(shape, r.ck.ClipOp.Intersect, true)
  else r.clipNodeShape(canvas, node)
  canvas.saveLayer(
    undefined,
    r.ck.LTRBRect(0, 0, node.width, node.height),
    filter,
    undefined,
    r.ck.TileMode.Clamp
  )
  canvas.restore()
  canvas.restore()
}

/**
 * Bends what lies behind the layer through its glass: refraction and dispersion over the
 * backdrop, frosted by the effect's radius. Drawn before the layer's fills.
 */
export function renderGlassRefraction(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  shape: Path | null
): void {
  const glass = glassParams(effect)
  const depth = glassDepth(glass.depth, node.width, node.height)
  const outline = glassOutline(r, node, shape)
  const refraction = compiledProgram(r.ck, r.shaders, GLASS_REFRACTION)
  // Drawing the map may fail; nothing else is made until it has.
  const inputs = shapeInputs(r, canvas, node, outline, depth)
  const sigma = glassBackdropSigma(effect)
  const blur = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
  let filter: ImageFilter | null = null
  try {
    filter = r.ck.ImageFilter.MakeRuntimeShaderWithInputs(
      refraction.effect,
      refraction.uniforms({
        ...glassGeometryUniforms(outline, depth),
        ...inputs.uniforms,
        refraction: glass.refraction,
        dispersion: glass.dispersion
      }),
      { backdrop: blur },
      glassSampleRadius(node, effect),
      { geometryMap: inputs.map }
    )
    if (filter) filterBackdrop(r, canvas, node, filter, shape)
  } finally {
    filter?.delete()
    blur.delete()
    inputs.release()
  }
}

/** Lights the layer's glass over its fills: a rim along the outline and a band inside it. */
export function renderGlassLight(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  shape: Path | null
): void {
  const glass = glassParams(effect)
  if (glass.lightIntensity <= 0) return
  const depth = glassDepth(glass.depth, node.width, node.height)
  const outline = glassOutline(r, node, shape)
  const light = compiledProgram(r.ck, r.shaders, GLASS_LIGHT)
  const inputs = shapeInputs(r, canvas, node, outline, depth)
  let filter: ImageFilter | null = null
  try {
    filter = r.ck.ImageFilter.MakeRuntimeShaderWithInputs(
      light.effect,
      light.uniforms({
        ...glassGeometryUniforms(outline, depth),
        ...inputs.uniforms,
        axis: glassLightAxis(glass.lightAngle),
        intensity: glass.lightIntensity
      }),
      { backdrop: null },
      1,
      { geometryMap: inputs.map }
    )
    if (filter) filterBackdrop(r, canvas, node, filter, shape)
  } finally {
    filter?.delete()
    inputs.release()
  }
}
