import { parseColor } from '#core/color'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import type { Fill, Stroke, VectorNetwork } from '#core/scene-graph'
import { parseSvgSize } from '#core/tools/create/svg'

function scaleVectorNetwork(network: VectorNetwork, sx: number, sy: number): VectorNetwork {
  return {
    vertices: network.vertices.map((vertex) => ({
      ...vertex,
      x: vertex.x * sx,
      y: vertex.y * sy
    })),
    segments: network.segments,
    regions: network.regions
  }
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

function resolveStrokes(path: IconPathInfo, defaultColor: string): Stroke[] {
  if (!path.stroke || path.stroke === 'none') return []
  const color = path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
  return [createPathStroke(color, path.strokeWidth, path.strokeCap, path.strokeJoin)]
}

export interface VectorizedPath {
  vectorNetwork: VectorNetwork
  fills: Fill[]
  strokes: Stroke[]
}

export interface SvgVectorizeResult {
  paths: VectorizedPath[]
}

export function svgToVectorPaths(
  svgText: string,
  bounds: { width: number; height: number },
  options?: { defaultColor?: string }
): SvgVectorizeResult | null {
  const paths = extractPaths(svgText)
  if (paths.length === 0) return null

  const { width: svgWidth, height: svgHeight } = parseSvgSize(svgText)
  if (svgWidth <= 0 || svgHeight <= 0) return null

  const sx = bounds.width / svgWidth
  const sy = bounds.height / svgHeight
  const defaultColor = options?.defaultColor ?? '#000000'

  const vectorized: VectorizedPath[] = []
  for (const path of paths) {
    const fillRule: WindingRule = path.fillRule
    const network = scaleVectorNetwork(parseSVGPath(path.d, fillRule), sx, sy)
    vectorized.push({
      vectorNetwork: network,
      fills: resolveFill(path, defaultColor),
      strokes: resolveStrokes(path, defaultColor)
    })
  }

  return { paths: vectorized }
}
