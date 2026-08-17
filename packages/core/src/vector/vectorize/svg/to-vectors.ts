/**
 * Maps vendor SVG into scene-graph vector networks.
 *
 * Raster vectorizers often return paths in viewBox user units while width/height
 * reflect the input pixel size. Scale path data from the SVG coordinate space
 * (viewBox, else width/height) into the target node bounds before parsing.
 */
import svgpath from 'svgpath'

import type { Fill, Stroke, VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import { mergeVectorNetworks } from '@open-pencil/scene-graph'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Rect, Size } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
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
    return [{ type: 'SOLID', color, opacity: 1, visible: true }]
  }
  if (path.fill === null && !path.stroke) {
    return [{ type: 'SOLID', color: parseColor(defaultColor), opacity: 1, visible: true }]
  }
  return []
}

function resolveStrokes(path: IconPathInfo, defaultColor: string, strokeScale = 1): Stroke[] {
  if (!path.stroke || path.stroke === 'none') return []
  const color = path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
  return [createPathStroke(color, path.strokeWidth * strokeScale, path.strokeCap, path.strokeJoin)]
}

export interface VectorizedPath {
  vectorNetwork: VectorNetwork
  fills: Fill[]
  strokes: Stroke[]
  clipNetworks?: VectorNetwork[]
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
  const clipCache = new WeakMap<NonNullable<IconPathInfo['clipPaths']>, VectorNetwork[]>()
  for (const path of paths) {
    const fillRule: WindingRule = path.fillRule
    const transform = path.transform ?? null
    const pathData = applySVGTransformToPath(path.d, transform)
    const scaledD = mapSVGPathToViewport(pathData, viewport)
    const network = parseSVGPath(scaledD, fillRule)
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
    let clipNetworks: VectorNetwork[] | undefined
    if (path.clipPaths) {
      const hasObjectBoundingBoxClip = path.clipPaths.some(
        ({ units }) => units === 'objectBoundingBox'
      )
      clipNetworks = hasObjectBoundingBoxClip ? undefined : clipCache.get(path.clipPaths)
      if (!clipNetworks) {
        clipNetworks = path.clipPaths.map((clipRegion) =>
          mergeVectorNetworks(
            clipRegion.paths.map((clipPath) => {
              let clipData = applySVGTransformToPath(clipPath.d, clipPath.transform ?? null)
              if (clipRegion.units === 'objectBoundingBox') {
                clipData = svgpath(clipData)
                  .scale(pathBounds.width, pathBounds.height)
                  .translate(pathBounds.x, pathBounds.y)
                  .toString()
                return parseSVGPath(clipData, clipPath.fillRule)
              }
              return parseSVGPath(mapSVGPathToViewport(clipData, viewport), clipPath.fillRule)
            })
          )
        )
        if (!hasObjectBoundingBoxClip) clipCache.set(path.clipPaths, clipNetworks)
      }
    }
    vectorized.push({
      vectorNetwork: network,
      fills: gradientFill ? [gradientFill] : resolveFill(path, defaultColor),
      strokes: resolveStrokes(path, defaultColor, strokeScale),
      clipNetworks
    })
  }

  return { paths: vectorized, contentBounds: unionPathBounds(vectorized) }
}
