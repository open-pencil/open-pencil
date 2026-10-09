/**
 * Maps vendor SVG into scene-graph vector networks.
 *
 * Raster vectorizers often return paths in viewBox user units while width/height
 * reflect the input pixel size. Scale path data from the SVG coordinate space
 * (viewBox, else width/height) into the target node bounds before parsing.
 */
import svgpath from 'svgpath'

import type { Fill, Stroke, VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import { parseColor } from '@open-pencil/scene-graph/color'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo, SVGElementLayer } from '#core/icons/types'
import { parseSVGSize, parseSVGViewBox } from '#core/io/formats/svg/metadata'
import { computeAccurateBounds } from '#core/vector/curve-math'

import { parseSVGGradients, resolveGradientFill } from './gradients'
import {
  applySVGTransformToPath,
  mapSVGPathToViewport,
  resolveSVGViewportMapping
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

function resolveFill(path: IconPathInfo, defaultColor: string): Fill[] {
  if (path.fill && path.fill !== 'none') {
    const color = path.fill === 'currentColor' ? parseColor(defaultColor) : parseColor(path.fill)
    return [{ type: 'SOLID', color, opacity: path.fillOpacity, visible: true }]
  }
  if (path.fill === null && !path.stroke) {
    return [{ type: 'SOLID', color: parseColor(defaultColor), opacity: 1, visible: true }]
  }
  return []
}

function resolveStrokes(path: IconPathInfo, defaultColor: string, strokeScale = 1): Stroke[] {
  if (!path.stroke || path.stroke === 'none') return []
  const color = path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
  const stroke = createPathStroke(
    color,
    path.strokeWidth * strokeScale,
    path.strokeCap,
    path.strokeJoin
  )
  return [{ ...stroke, opacity: path.strokeOpacity }]
}

export interface VectorizedClip {
  /** The `<clipPath>` element's `id`. */
  id: string
  /** One network per clip shape. */
  shapes: VectorNetwork[]
}

export interface VectorizedPath {
  vectorNetwork: VectorNetwork
  fills: Fill[]
  strokes: Stroke[]
  /** The clip regions around the path, ordered like `IconPathInfo.clipPaths`. */
  clips?: VectorizedClip[]
  elements: SVGElementLayer[]
}

export interface SVGVectorizeResult {
  paths: VectorizedPath[]
  /** Tight bounds of path geometry in the target coordinate space. */
  contentBounds: Rect
}

export function svgToVectorPaths(
  svgText: string,
  bounds: Size,
  options?: { defaultColor?: string; preserveAspectRatio?: boolean }
): SVGVectorizeResult | null {
  const paths = extractPaths(svgText)
  if (paths.length === 0) return null

  const space = parseSVGCoordinateSpace(svgText)
  if (space.width <= 0 || space.height <= 0) return null

  const defaultColor = options?.defaultColor ?? '#000000'
  const gradients = parseSVGGradients(svgText)
  const viewport = resolveSVGViewportMapping(
    svgText,
    space,
    bounds,
    options?.preserveAspectRatio ?? false
  )
  const strokeScale = Math.min(viewport.scaleX, viewport.scaleY)

  const vectorized: VectorizedPath[] = []
  const clipCache = new WeakMap<NonNullable<IconPathInfo['clipPaths']>, VectorizedClip[]>()
  for (const path of paths) {
    const fillRule: WindingRule = path.fillRule
    const transform = path.transform ?? null
    const pathData = applySVGTransformToPath(path.d, transform)
    const scaledD = mapSVGPathToViewport(pathData, viewport)
    const solidFills = resolveFill(path, defaultColor)
    const strokes = resolveStrokes(path, defaultColor, strokeScale)
    // A stroke would also trace the closing edge of an open subpath in the fill region.
    const network = parseSVGPath(scaledD, fillRule, {
      includeOpenRegions: solidFills.length > 0 && strokes.length === 0
    })
    const pathBounds = computeAccurateBounds(network)
    const gradientFill =
      gradients.size > 0
        ? resolveGradientFill(
            path.fill,
            gradients,
            transform,
            viewport,
            computeAccurateBounds(network)
          )
        : null
    let clips: VectorizedClip[] | undefined
    if (path.clipPaths) {
      const hasObjectBoundingBoxClip = path.clipPaths.some(
        ({ units }) => units === 'objectBoundingBox'
      )
      clips = hasObjectBoundingBoxClip ? undefined : clipCache.get(path.clipPaths)
      if (!clips) {
        clips = path.clipPaths.map((clipRegion) => ({
          id: clipRegion.id,
          shapes: clipRegion.paths.map((clipPath) => {
            let clipData = applySVGTransformToPath(clipPath.d, clipPath.transform ?? null)
            if (clipRegion.units === 'objectBoundingBox') {
              clipData = svgpath(clipData)
                .scale(pathBounds.width, pathBounds.height)
                .translate(pathBounds.x, pathBounds.y)
                .toString()
              return parseSVGPath(clipData, clipPath.fillRule, { includeOpenRegions: true })
            }
            return parseSVGPath(mapSVGPathToViewport(clipData, viewport), clipPath.fillRule, {
              includeOpenRegions: true
            })
          })
        }))
        if (!hasObjectBoundingBoxClip) clipCache.set(path.clipPaths, clips)
      }
    }
    vectorized.push({
      vectorNetwork: network,
      fills: gradientFill ? [{ ...gradientFill, opacity: path.fillOpacity }] : solidFills,
      strokes,
      clips,
      elements: path.elements
    })
  }

  return { paths: vectorized, contentBounds: unionPathBounds(vectorized) }
}
