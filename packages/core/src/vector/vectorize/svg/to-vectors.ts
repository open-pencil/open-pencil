/**
 * Maps vendor SVG into scene-graph vector networks.
 *
 * Raster vectorizers often return paths in viewBox user units while width/height
 * reflect the input pixel size. Scale path data from the SVG coordinate space
 * (viewBox, else width/height) into the target node bounds before parsing.
 */
import svgpath from 'svgpath'

import type { Fill, Stroke, VectorNetwork } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { IconPaint } from '@open-pencil/scene-graph/icons'
import type { Mat3 } from '@open-pencil/scene-graph/matrix'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Color, Rect, Size, Vector } from '@open-pencil/scene-graph/primitives'

import { createPathStroke } from '#core/icons/path-style'
import { extractSVGContent, isSVGPathShown, type SVGContent } from '#core/icons/svg'
import type {
  IconPathInfo,
  SVGClipPathInfo,
  SVGClipPathRegion,
  SVGElementLayer,
  SVGTextPiece,
  SVGTextRun
} from '#core/icons/types'
import { parseSVGSize, parseSVGViewBox } from '#core/io/formats/svg/metadata'
import { computeAccurateBounds } from '#core/vector/curve-math'

import { resolveGradientFill } from './gradients'
import {
  type SVGViewportMapping,
  applySVGTransformToPath,
  mapSVGPathToViewport,
  placeSVGPath,
  resolveSVGViewportMapping,
  svgStrokeScale,
  svgViewportAttributes
} from './transform'

function parseSVGCoordinateSpace(svg: string): Rect {
  const viewBox = parseSVGViewBox(svg)
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) return viewBox
  const size = parseSVGSize(svg)
  return { x: 0, y: 0, width: size.width, height: size.height }
}

function unionPathBounds(paths: VectorizedPath[]): Rect {
  const rects = paths
    .map((path) => computeAccurateBounds(path.vectorNetwork))
    .filter((bounds) => bounds.width > 0 && bounds.height > 0)
  return computeBounds(rects)
}

const CURRENT_COLOR = 'currentColor'

/** A paint string as a color: `currentColor` takes the host's color, which `tint` records. */
function paintColor(paint: string, defaultColor: string): Color {
  return parseColor(paint === CURRENT_COLOR ? defaultColor : paint)
}

/** The paints a path draws with and which of them are the host's color. */
interface PathPaints {
  fills: Fill[]
  strokes: Stroke[]
  tint: IconPaint[]
}

function pathPaints(
  path: IconPathInfo,
  defaultColor: string,
  strokeScale: number,
  gradient: (paint: string) => Fill | null
): PathPaints {
  const tint: IconPaint[] = []
  const fills: Fill[] = []
  const strokes: Stroke[] = []
  if (path.fill) {
    const fill = gradient(path.fill) ?? {
      type: 'SOLID' as const,
      color: paintColor(path.fill, defaultColor),
      opacity: 1,
      visible: true
    }
    fills.push({ ...fill, opacity: path.fillOpacity })
    if (path.fill === CURRENT_COLOR) tint.push('fill')
  }
  if (path.stroke) {
    const line = createPathStroke(
      paintColor(path.stroke, defaultColor),
      path.strokeWidth * strokeScale,
      path.strokeCap,
      path.strokeJoin
    )
    // A gradient stroke keeps the line's weight, alignment, cap, and join.
    strokes.push({ ...line, ...gradient(path.stroke), opacity: path.strokeOpacity })
    if (path.stroke === CURRENT_COLOR) tint.push('stroke')
  }
  return { fills, strokes, tint }
}

export interface VectorizedClip {
  /** The `<clipPath>` element's `id`. */
  id: string
  /** False when the `<clipPath>` itself is hidden, so it clips nothing. */
  visible: boolean
  /** One network per clip shape, hidden ones included, as Figma keeps them. */
  shapes: Array<{ network: VectorNetwork; visible: boolean }>
}

export interface VectorizedPath {
  vectorNetwork: VectorNetwork
  fills: Fill[]
  strokes: Stroke[]
  /** The paints drawn in `currentColor`, which an icon's color fills. */
  tint: IconPaint[]
  /** The clip regions around the path, ordered like `IconPathInfo.clipPaths`. */
  clips?: VectorizedClip[]
  elements: SVGElementLayer[]
}

/** SVG text, placed by the matrix from its element's coordinates into the target bounds. */
export type VectorizedTextPiece = Omit<SVGTextPiece, 'runs'> & {
  runs: Array<SVGTextRun & { fills: Fill[] }>
}

export interface VectorizedText {
  pieces: VectorizedTextPiece[]
  matrix: Mat3
  clips?: VectorizedClip[]
  elements: SVGElementLayer[]
  /** How many paths come before the text in drawing order. */
  pathIndex: number
}

export interface SVGVectorizeResult {
  paths: VectorizedPath[]
  texts: VectorizedText[]
  /** Tight bounds of the shown paths' geometry in the target coordinate space. */
  contentBounds: Rect
}

/** SVG content, extracted with the gradients it paints with, for {@link vectorizeSVGContent}. */
export type SVGVectorizeSource = Pick<SVGContent, 'paths' | 'texts' | 'gradients'>

/**
 * SVG content as vector networks and paints placed through `viewport`, the one way pasted and
 * imported SVG, icons, and design JSX `<svg>` turn SVG shapes into layers. `currentColor` paints
 * take `defaultColor`, and each path's `tint` says which of its paints they were.
 */
export function vectorizeSVGContent(
  { paths, texts, gradients }: SVGVectorizeSource,
  viewport: SVGViewportMapping,
  defaultColor = '#000000'
): SVGVectorizeResult {
  const vectorized: VectorizedPath[] = []
  const clipCache: ClipCache = new WeakMap()
  for (const path of paths) {
    const transform = path.transform ?? null
    // Arcs become curves before rounding, as the path parser would turn them anyway: rounding an
    // arc's own end can put it on its start, and a degenerate arc draws nothing.
    const placedD = placeSVGPath(applySVGTransformToPath(path.d, transform), null, viewport)
      .abs()
      .unshort()
      .unarc()
      .round(2)
      .toString()
    // A stroke would also trace the closing edge of an open subpath in the fill region.
    const network = parseSVGPath(placedD, path.fillRule, {
      includeOpenRegions: path.fill !== null && path.stroke === null
    })
    const pathBounds = computeAccurateBounds(network)
    const paints = pathPaints(path, defaultColor, svgStrokeScale(transform, viewport), (paint) =>
      gradients.size > 0
        ? resolveGradientFill(paint, gradients, transform, viewport, pathBounds)
        : null
    )
    const clips = path.clipPaths && vectorizeClips(path.clipPaths, viewport, pathBounds, clipCache)
    vectorized.push({ vectorNetwork: network, ...paints, clips, elements: path.elements })
  }

  return {
    paths: vectorized,
    texts: texts.map((text) => ({
      pieces: text.pieces.map((piece) => ({
        ...piece,
        runs: piece.runs.map((run) => ({ ...run, fills: resolveTextFill(run, defaultColor) }))
      })),
      matrix: transformMatrix(text.transform, viewport),
      clips: text.clipPaths && vectorizeClips(text.clipPaths, viewport, null, clipCache),
      elements: text.elements,
      pathIndex: text.pathIndex
    })),
    contentBounds: unionPathBounds(vectorized.filter(isSVGPathShown))
  }
}

/** SVG markup as vectors in `bounds`, its viewBox mapped as the outermost `<svg>` says. */
export function svgToVectorPaths(
  svgText: string,
  bounds: Size,
  options?: { defaultColor?: string; preserveAspectRatio?: boolean }
): SVGVectorizeResult | null {
  const content = extractSVGContent(svgText)
  if (content.paths.length === 0 && content.texts.length === 0) return null

  const space = parseSVGCoordinateSpace(svgText)
  if (space.width <= 0 || space.height <= 0) return null

  const attributes = svgViewportAttributes(svgText)
  // Vectorizer output is stretched over the image it replaces, whatever its own aspect ratio.
  const viewport = resolveSVGViewportMapping(
    space,
    bounds,
    options?.preserveAspectRatio ? attributes : { ...attributes, preserveAspectRatio: 'none' }
  )
  return vectorizeSVGContent(content, viewport, options?.defaultColor)
}

type ClipCache = WeakMap<NonNullable<IconPathInfo['clipPaths']>, VectorizedClip[]>

/**
 * Clip regions as networks in the target space. An objectBoundingBox clip follows the bounds of
 * what it clips, which text has only once laid out, so without bounds such a clip has no shapes.
 */
function vectorizeClips(
  clipPaths: NonNullable<IconPathInfo['clipPaths']>,
  viewport: SVGViewportMapping,
  objectBounds: Rect | null,
  cache: ClipCache
): VectorizedClip[] {
  const hasObjectBoundingBoxClip = clipPaths.some(({ units }) => units === 'objectBoundingBox')
  const cached = hasObjectBoundingBoxClip ? undefined : cache.get(clipPaths)
  if (cached) return cached
  const clips = clipPaths.map((clipRegion) => ({
    id: clipRegion.id,
    visible: clipRegion.visible,
    shapes:
      clipRegion.units === 'objectBoundingBox' && !objectBounds
        ? []
        : clipRegion.paths.map((clipPath) => ({
            network: clipNetwork(clipPath, clipRegion.units, viewport, objectBounds),
            visible: clipPath.visible
          }))
  }))
  if (!hasObjectBoundingBoxClip) cache.set(clipPaths, clips)
  return clips
}

function clipNetwork(
  clipPath: SVGClipPathInfo,
  units: SVGClipPathRegion['units'],
  viewport: SVGViewportMapping,
  objectBounds: Rect | null
): VectorNetwork {
  let clipData = applySVGTransformToPath(clipPath.d, clipPath.transform ?? null)
  if (units === 'objectBoundingBox' && objectBounds) {
    clipData = svgpath(clipData)
      .scale(objectBounds.width, objectBounds.height)
      .translate(objectBounds.x, objectBounds.y)
      .toString()
    return parseSVGPath(clipData, clipPath.fillRule, { includeOpenRegions: true })
  }
  return parseSVGPath(mapSVGPathToViewport(clipData, viewport), clipPath.fillRule, {
    includeOpenRegions: true
  })
}

/** The matrix taking an element's own coordinates, under `transform`, into the target space. */
function transformMatrix(transform: string | null, viewport: SVGViewportMapping): Mat3 {
  const points: Vector[] = []
  svgpath(mapSVGPathToViewport(applySVGTransformToPath('M0 0M1 0M0 1', transform), viewport))
    .abs()
    .iterate((segment) => {
      if (segment[0] === 'M') points.push({ x: segment[1], y: segment[2] })
    })
  const [origin = { x: 0, y: 0 }, unitX = { x: 1, y: 0 }, unitY = { x: 0, y: 1 }] = points
  return [
    unitX.x - origin.x,
    unitY.x - origin.x,
    origin.x,
    unitX.y - origin.y,
    unitY.y - origin.y,
    origin.y,
    0,
    0,
    1
  ]
}

function resolveTextFill(run: SVGTextRun, defaultColor: string): Fill[] {
  const color =
    run.fill === null || run.fill === 'currentColor'
      ? parseColor(defaultColor)
      : parseColor(run.fill)
  return [{ type: 'SOLID', color, opacity: run.fillOpacity, visible: true }]
}
