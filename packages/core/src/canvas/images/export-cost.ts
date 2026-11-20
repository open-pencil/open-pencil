import type { SceneNode, Stroke } from '@open-pencil/scene-graph'
import { strokeAlignShare } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'

import type { ExportSource, ExportTarget } from './state'

const SOURCE_PIXELS_PER_SHADER_RUN = 100

export function areaScale(matrix: Mat3): number {
  return Math.abs(matrix[0] * matrix[4] - matrix[1] * matrix[3])
}

function strokeReach(node: SceneNode, stroke: Stroke): number {
  if (!node.independentStrokeWeights) {
    return stroke.weight
  }
  return Math.max(
    stroke.weight,
    node.borderTopWeight,
    node.borderRightWeight,
    node.borderBottomWeight,
    node.borderLeftWeight
  )
}

interface StrokeBand {
  outward: number
  inward: number
}

function strokeBand(node: SceneNode, stroke: Stroke): StrokeBand {
  const reach = strokeReach(node, stroke)
  const outward = reach * strokeAlignShare(stroke.align)
  return { outward, inward: reach - outward }
}

function strokeBandArea(width: number, height: number, band: StrokeBand): number {
  const outer = (width + 2 * band.outward) * (height + 2 * band.outward)
  const inner = Math.max(0, width - 2 * band.inward) * Math.max(0, height - 2 * band.inward)
  return outer - inner
}

function visibleBoxArea(target: ExportTarget, matrix: Mat3, node: SceneNode, reach: number) {
  const [left, top, right, bottom] = [-reach, -reach, node.width + reach, node.height + reach]
  const [x0, y0, x1, y1, x2, y2, x3, y3] = Matrix.mapPoints(matrix, [
    left,
    top,
    right,
    top,
    right,
    bottom,
    left,
    bottom
  ])
  const [clipLeft, clipTop, clipRight, clipBottom] = target.canvas.getDeviceClipBounds()
  const width =
    Math.min(clipRight, Math.max(x0, x1, x2, x3)) - Math.max(clipLeft, Math.min(x0, x1, x2, x3))
  const height =
    Math.min(clipBottom, Math.max(y0, y1, y2, y3)) - Math.max(clipTop, Math.min(y0, y1, y2, y3))
  return Math.max(0, width) * Math.max(0, height)
}

export function coveredRasterPixels(
  target: ExportTarget | null,
  node: SceneNode,
  stroke?: Stroke
): number {
  if (!target) {
    return Number.POSITIVE_INFINITY
  }
  const matrix = target.canvas.getTotalMatrix()
  const band = stroke ? strokeBand(node, stroke) : { outward: 0, inward: 0 }
  const localArea = stroke
    ? strokeBandArea(node.width, node.height, band)
    : node.width * node.height
  const painted = Math.min(
    localArea * areaScale(matrix),
    visibleBoxArea(target, matrix, node, band.outward)
  )
  const covered = painted * target.rasterPixelsPerDeviceUnit ** 2
  return Number.isNaN(covered) ? Number.POSITIVE_INFINITY : covered
}

export function shaderIsCheaper(source: ExportSource, coveredPixels: number): boolean {
  if (!source.bakesExactly) {
    return true
  }
  const sourcePixels = source.width * source.height
  if (sourcePixels <= coveredPixels) {
    return false
  }
  const leastBakeCost = sourcePixels / SOURCE_PIXELS_PER_SHADER_RUN
  if (leastBakeCost >= coveredPixels) {
    return true
  }
  if (source.distinctColors === null) {
    return false
  }
  return source.distinctColors + leastBakeCost >= coveredPixels
}
