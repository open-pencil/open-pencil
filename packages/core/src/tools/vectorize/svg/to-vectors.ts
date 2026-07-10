/**
 * Maps vendor SVG into scene-graph vector networks.
 *
 * Raster vectorizers often return paths in viewBox user units while width/height
 * reflect the input pixel size. Scale path data from the SVG coordinate space
 * (viewBox, else width/height) into the target node bounds before parsing.
 */
import svgpath from 'svgpath'

import type { Fill, Stroke, VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import { parseSvgSize, parseSvgViewBox } from '#core/tools/create/svg'
import { parseSVGGradients, resolveGradientFill } from '#core/tools/vectorize/svg/gradients'
import { applySVGTransformToPath } from '#core/tools/vectorize/svg/transform'
import { computeAccurateBounds } from '#core/vector'

/** Map path data from SVG user space (viewBox) into target pixel bounds. */
function mapPathDataToBounds(
  d: string,
  space: Rect,
  target: { width: number; height: number }
): string {
  const sx = target.width / space.width
  const sy = target.height / space.height
  return svgpath(d).translate(-space.x, -space.y).scale(sx, sy).toString()
}

function parseSVGCoordinateSpace(svg: string): Rect {
  const viewBox = parseSvgViewBox(svg)
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) return viewBox
  const size = parseSvgSize(svg)
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
}

export interface SVGVectorizeResult {
  paths: VectorizedPath[]
  /** Tight bounds of path geometry in the target coordinate space. */
  contentBounds: Rect
}

export function svgToVectorPaths(
  svgText: string,
  bounds: { width: number; height: number },
  options?: { defaultColor?: string }
): SVGVectorizeResult | null {
  const paths = extractPaths(svgText)
  if (paths.length === 0) return null

  const space = parseSVGCoordinateSpace(svgText)
  if (space.width <= 0 || space.height <= 0) return null

  const defaultColor = options?.defaultColor ?? '#000000'
  const gradients = parseSVGGradients(svgText)
  // Path coordinates are scaled from SVG space into the target bounds; scale stroke
  // width by the same (uniform) factor so thickness matches the transformed geometry.
  const strokeScale = Math.min(bounds.width / space.width, bounds.height / space.height)

  const vectorized: VectorizedPath[] = []
  for (const path of paths) {
    const fillRule: WindingRule = path.fillRule
    const pathData = applySVGTransformToPath(path.d, path.transform)
    const scaledD = mapPathDataToBounds(pathData, space, bounds)
    const network = parseSVGPath(scaledD, fillRule)
    const gradientFill =
      gradients.size > 0
        ? resolveGradientFill(
            path.fill,
            gradients,
            path.transform,
            space,
            bounds,
            computeAccurateBounds(network)
          )
        : null
    vectorized.push({
      vectorNetwork: network,
      fills: gradientFill ? [gradientFill] : resolveFill(path, defaultColor),
      strokes: resolveStrokes(path, defaultColor, strokeScale)
    })
  }

  return { paths: vectorized, contentBounds: unionPathBounds(vectorized) }
}
