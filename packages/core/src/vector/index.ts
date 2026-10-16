export * from './vectorize'
export * from './handle-selection'
export { freehandNetwork, simplifyFreehand } from './freehand'

export {
  breakAtVertex,
  computeAccurateBounds,
  deleteVertex,
  findAllHandles,
  findOppositeHandle,
  mirrorHandle,
  nearestPointOnNetwork,
  removeVertex,
  splitSegmentAt
} from './bezier'

import type { CanvasKit, Path } from 'canvaskit-wasm'

export {
  buildStyleOverrideTable,
  decodeVectorNetworkBlob,
  encodeVectorNetworkBlob
} from '@open-pencil/fig/node-change'
import type { VectorNetwork, WindingRule } from '@open-pencil/scene-graph'

import { addLoopToPath, addOpenSegmentsToPath } from './path-helpers'
export { vectorNetworkToCenterlinePath, fitCircleArc, isClosedThinCrescent } from './centerline'
export { regenerateFillGeometry } from './fill-geometry'
export { addStrokeRunToPath, strokeRuns, type StrokeRun } from './path-helpers'

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

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_QUAD_TO = 3
const CMD_CUBIC_TO = 4

export function geometryBlobToPath(
  ck: CanvasKit,
  blob: Uint8Array,
  windingRule: WindingRule
): Path {
  const path = new ck.PathBuilder()
  if (!(blob.buffer instanceof ArrayBuffer)) return path.detachAndDelete()
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case CMD_CLOSE:
        path.close()
        break
      case CMD_MOVE_TO: {
        const x = dv.getFloat32(o, true)
        const y = dv.getFloat32(o + 4, true)
        o += 8
        path.moveTo(x, y)
        break
      }
      case CMD_LINE_TO: {
        const x = dv.getFloat32(o, true)
        const y = dv.getFloat32(o + 4, true)
        o += 8
        path.lineTo(x, y)
        break
      }
      case CMD_QUAD_TO: {
        const x1 = dv.getFloat32(o, true)
        const y1 = dv.getFloat32(o + 4, true)
        const x = dv.getFloat32(o + 8, true)
        const y = dv.getFloat32(o + 12, true)
        o += 16
        path.quadTo(x1, y1, x, y)
        break
      }
      case CMD_CUBIC_TO: {
        const x1 = dv.getFloat32(o, true)
        const y1 = dv.getFloat32(o + 4, true)
        const x2 = dv.getFloat32(o + 8, true)
        const y2 = dv.getFloat32(o + 12, true)
        const x = dv.getFloat32(o + 16, true)
        const y = dv.getFloat32(o + 20, true)
        o += 24
        path.cubicTo(x1, y1, x2, y2, x, y)
        break
      }
      default:
        return path.detachAndDelete()
    }
  }

  const result = path.detachAndDelete()
  result.setFillType(fillType(ck, windingRule))
  return result
}
