export * from './vectorize'
export * from './handle-selection'
export { freehandNetwork, simplifyFreehand } from './freehand'

export {
  breakAtVertex,
  computeAccurateBounds,
  deleteVectorParts,
  deleteVertex,
  findAllHandles,
  findOppositeHandle,
  mirrorHandle,
  nearestPointOnNetwork,
  removeVertex,
  splitSegmentAt
} from './bezier'

import type { CanvasKit, Path } from 'canvaskit-wasm'

import type { VectorNetwork, WindingRule } from '@open-pencil/scene-graph'
import { GeometryCommand, readGeometryBlob } from '@open-pencil/scene-graph/geometry'

import { addLoopToPath, addOpenSegmentsToPath } from './path-helpers'
export { vectorNetworkToCenterlinePath, fitCircleArc, isClosedThinCrescent } from './centerline'
export { regenerateFillGeometry } from './fill-geometry'
export { regionAtPoint, regionHatchPeriod, regionVertexIndices } from './region-hit'
export { addStrokeRunToPath, strokeRuns, type StrokeRun } from './path-helpers'
export { vectorChangesFromPagePath, type VectorPathChanges } from './placement'

/**
 * Fill types go on the detached `Path`: CanvasKit 0.41's `PathBuilder.setFillType` returns an
 * undeleted copy of the builder, which leaks about 860 bytes per call.
 */
function fillType(ck: CanvasKit, windingRule: WindingRule) {
  return windingRule === 'EVENODD' ? ck.FillType.EvenOdd : ck.FillType.Winding
}

/** A vector network's paths; `cornerRadius` rounds open corners that set no radius of their own. */
export function vectorNetworkToPath(
  ck: CanvasKit,
  network: VectorNetwork,
  cornerRadius = 0
): Path[] {
  const { vertices, segments, regions } = network

  if (regions.length > 0) {
    const paths: Path[] = []
    const regionSegmentIndexes = new Set<number>()
    for (const region of regions) {
      const regionPath = new ck.PathBuilder()
      for (const loop of region.loops) {
        for (const segmentIndex of loop) regionSegmentIndexes.add(segmentIndex)
        addLoopToPath(regionPath, loop, segments, vertices)
      }
      const path = regionPath.detachAndDelete()
      path.setFillType(fillType(ck, region.windingRule))
      paths.push(path)
    }

    const openSegments = segments.filter((_, index) => !regionSegmentIndexes.has(index))
    if (openSegments.length > 0) {
      const openPath = new ck.PathBuilder()
      addOpenSegmentsToPath(openPath, openSegments, vertices, cornerRadius)
      paths.push(openPath.detachAndDelete())
    }
    return paths
  }

  const path = new ck.PathBuilder()
  addOpenSegmentsToPath(path, segments, vertices, cornerRadius)
  return [path.detachAndDelete()]
}

export function geometryBlobToPath(
  ck: CanvasKit,
  blob: Uint8Array,
  windingRule: WindingRule
): Path {
  const path = new ck.PathBuilder()
  if (!(blob.buffer instanceof ArrayBuffer)) return path.detachAndDelete()
  readGeometryBlob(blob, (command, c) => {
    if (command === GeometryCommand.CLOSE) path.close()
    else if (command === GeometryCommand.MOVE) path.moveTo(c[0], c[1])
    else if (command === GeometryCommand.LINE) path.lineTo(c[0], c[1])
    else if (command === GeometryCommand.QUAD) path.quadTo(c[0], c[1], c[2], c[3])
    else path.cubicTo(c[0], c[1], c[2], c[3], c[4], c[5])
  })
  const result = path.detachAndDelete()
  result.setFillType(fillType(ck, windingRule))
  return result
}
export {
  cubicExtrema,
  isLineSegment,
  nearestPointOnCubic,
  segmentToAbsolute,
  splitCubicAt,
  type CubicPoints,
  type NearestResult,
  type NetworkNearestResult
} from './curve-math'
export { extractSubNetwork, findConnectedComponents } from './connectivity'
