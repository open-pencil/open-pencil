import type {
  HandleMirroring,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex,
  WindingRule
} from './scene-graph'
import type { CanvasKit, Path } from 'canvaskit-wasm'
import type { Rect } from './types'

// --- vectorNetworkBlob binary format ---
// Header:  [numVertices:u32, numSegments:u32, numRegions:u32]  (12 bytes)
// Vertex:  [styleOverrideIdx:u32, x:f32, y:f32]               (12 bytes)
// Segment: [styleOverrideIdx:u32, start:u32, tsX:f32, tsY:f32, end:u32, teX:f32, teY:f32]  (28 bytes)
// Region:  [windingRule:u32, numLoops:u32, {numSegs:u32, segIdx...}... ]  (variable)

interface StyleOverride {
  styleID: number
  handleMirroring?: string
}

export function decodeVectorNetworkBlob(
  data: Uint8Array,
  styleOverrideTable?: StyleOverride[]
): VectorNetwork {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let o = 0

  const nV = view.getUint32(o, true)
  o += 4
  const nS = view.getUint32(o, true)
  o += 4
  const nR = view.getUint32(o, true)
  o += 4

  const styleMap = new Map<number, StyleOverride>()
  if (styleOverrideTable) {
    for (const entry of styleOverrideTable) {
      styleMap.set(entry.styleID, entry)
    }
  }

  const vertices: VectorVertex[] = []
  for (let i = 0; i < nV; i++) {
    const styleIdx = view.getUint32(o, true)
    o += 4
    const x = view.getFloat32(o, true)
    o += 4
    const y = view.getFloat32(o, true)
    o += 4

    const override = styleMap.get(styleIdx)
    vertices.push({
      x,
      y,
      handleMirroring: (override?.handleMirroring as HandleMirroring | undefined) ?? 'NONE'
    })
  }

  const segments: VectorSegment[] = []
  for (let i = 0; i < nS; i++) {
    o += 4 // styleOverrideIdx (unused for segments currently)
    const start = view.getUint32(o, true)
    o += 4
    const tsX = view.getFloat32(o, true)
    o += 4
    const tsY = view.getFloat32(o, true)
    o += 4
    const end = view.getUint32(o, true)
    o += 4
    const teX = view.getFloat32(o, true)
    o += 4
    const teY = view.getFloat32(o, true)
    o += 4

    segments.push({
      start,
      end,
      tangentStart: { x: tsX, y: tsY },
      tangentEnd: { x: teX, y: teY }
    })
  }

  const regions: VectorRegion[] = []
  for (let i = 0; i < nR; i++) {
    const windingRuleU32 = view.getUint32(o, true)
    o += 4
    const windingRule: WindingRule = windingRuleU32 === 0 ? 'EVENODD' : 'NONZERO'
    const numLoops = view.getUint32(o, true)
    o += 4
    const loops: number[][] = []
    for (let j = 0; j < numLoops; j++) {
      const numSegs = view.getUint32(o, true)
      o += 4
      const loop: number[] = []
      for (let k = 0; k < numSegs; k++) {
        loop.push(view.getUint32(o, true))
        o += 4
      }
      loops.push(loop)
    }
    regions.push({ windingRule, loops })
  }

  return { vertices, segments, regions }
}

export function encodeVectorNetworkBlob(network: VectorNetwork): Uint8Array {
  const { vertices, segments, regions } = network

  let regionBytes = 0
  for (const region of regions) {
    regionBytes += 8 // windingRule + numLoops
    for (const loop of region.loops) {
      regionBytes += 4 + loop.length * 4 // numSegs + indices
    }
  }

  const totalBytes = 12 + vertices.length * 12 + segments.length * 28 + regionBytes
  const buf = new ArrayBuffer(totalBytes)
  const view = new DataView(buf)
  let o = 0

  view.setUint32(o, vertices.length, true)
  o += 4
  view.setUint32(o, segments.length, true)
  o += 4
  view.setUint32(o, regions.length, true)
  o += 4

  for (const v of vertices) {
    view.setUint32(o, 0, true)
    o += 4 // styleOverrideIdx (TODO: encode handleMirroring)
    view.setFloat32(o, v.x, true)
    o += 4
    view.setFloat32(o, v.y, true)
    o += 4
  }

  for (const seg of segments) {
    view.setUint32(o, 0, true)
    o += 4 // styleOverrideIdx
    view.setUint32(o, seg.start, true)
    o += 4
    view.setFloat32(o, seg.tangentStart.x, true)
    o += 4
    view.setFloat32(o, seg.tangentStart.y, true)
    o += 4
    view.setUint32(o, seg.end, true)
    o += 4
    view.setFloat32(o, seg.tangentEnd.x, true)
    o += 4
    view.setFloat32(o, seg.tangentEnd.y, true)
    o += 4
  }

  for (const region of regions) {
    view.setUint32(o, region.windingRule === 'EVENODD' ? 0 : 1, true)
    o += 4
    view.setUint32(o, region.loops.length, true)
    o += 4
    for (const loop of region.loops) {
      view.setUint32(o, loop.length, true)
      o += 4
      for (const segIdx of loop) {
        view.setUint32(o, segIdx, true)
        o += 4
      }
    }
  }

  return new Uint8Array(buf)
}

export function vectorNetworkToPath(ck: CanvasKit, network: VectorNetwork): Path[] {
  const { vertices, segments, regions } = network

  if (regions.length > 0) {
    const paths: Path[] = []
    for (const region of regions) {
      const regionPath = new ck.Path()
      for (const loop of region.loops) {
        addLoopToPath(regionPath, loop, segments, vertices)
      }
      regionPath.setFillType(
        region.windingRule === 'EVENODD' ? ck.FillType.EvenOdd : ck.FillType.Winding
      )
      paths.push(regionPath)
    }
    return paths
  }

  // No regions — draw all segments as open paths, tracking direction
  const path = new ck.Path()
  const visited = new Set<number>()
  const chains = buildChains(segments, vertices.length)

  for (const chain of chains) {
    if (chain.length === 0) continue
    // Determine starting vertex by tracing chain direction
    let current = findChainStart(chain, segments)
    path.moveTo(vertices[current].x, vertices[current].y)

    for (const segIdx of chain) {
      visited.add(segIdx)
      const seg = segments[segIdx]
      const forward = seg.start === current
      addSegmentDirected(path, seg, vertices, forward)
      current = forward ? seg.end : seg.start
    }
  }

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue
    const seg = segments[i]
    path.moveTo(vertices[seg.start].x, vertices[seg.start].y)
    addSegmentDirected(path, seg, vertices, true)
  }

  return [path]
}

function addLoopToPath(
  path: Path,
  loop: number[],
  segments: VectorSegment[],
  vertices: VectorVertex[]
): void {
  if (loop.length === 0) return

  const firstSeg = segments[loop[0]]

  // Determine the starting vertex — if the loop has multiple segments,
  // the first segment's direction is determined by which vertex connects
  // to the second segment.
  let current: number
  if (loop.length === 1) {
    current = firstSeg.start
  } else {
    const secondSeg = segments[loop[1]]
    if (firstSeg.end === secondSeg.start || firstSeg.end === secondSeg.end) {
      current = firstSeg.start
    } else {
      current = firstSeg.end
    }
  }

  path.moveTo(vertices[current].x, vertices[current].y)

  for (const segIdx of loop) {
    const seg = segments[segIdx]
    const forward = seg.start === current
    addSegmentDirected(path, seg, vertices, forward)
    current = forward ? seg.end : seg.start
  }

  path.close()
}

function addSegmentDirected(
  path: Path,
  seg: VectorSegment,
  vertices: VectorVertex[],
  forward: boolean
): void {
  const p0 = forward ? vertices[seg.start] : vertices[seg.end]
  const p3 = forward ? vertices[seg.end] : vertices[seg.start]
  const ts = seg.tangentStart
  const te = seg.tangentEnd

  const isLine = ts.x === 0 && ts.y === 0 && te.x === 0 && te.y === 0
  if (isLine) {
    path.lineTo(p3.x, p3.y)
  } else if (forward) {
    path.cubicTo(p0.x + ts.x, p0.y + ts.y, p3.x + te.x, p3.y + te.y, p3.x, p3.y)
  } else {
    // Reversed cubic: swap control points
    path.cubicTo(p0.x + te.x, p0.y + te.y, p3.x + ts.x, p3.y + ts.y, p3.x, p3.y)
  }
}

function findChainStart(chain: number[], segments: VectorSegment[]): number {
  if (chain.length < 2) return segments[chain[0]].start

  const first = segments[chain[0]]
  const second = segments[chain[1]]
  // The shared vertex between first and second is the "end" of the first
  // segment in this chain — so the start is the other vertex.
  if (first.start === second.start || first.start === second.end) return first.end
  return first.start
}

function buildChains(segments: VectorSegment[], _vertexCount: number): number[][] {
  if (segments.length === 0) return []

  // Build adjacency: for each vertex, which segments connect to it
  const adj = new Map<number, number[]>()
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    if (!adj.has(s.start)) adj.set(s.start, [])
    if (!adj.has(s.end)) adj.set(s.end, [])
    adj.get(s.start)?.push(i)
    adj.get(s.end)?.push(i)
  }

  const visited = new Set<number>()
  const chains: number[][] = []

  // Start from degree-1 vertices (endpoints) or any unvisited
  const degree1 = [...adj.entries()].filter(([, segs]) => segs.length === 1).map(([v]) => v)

  const startVertices = degree1.length > 0 ? degree1 : [segments[0].start]

  for (const startVertex of startVertices) {
    let current = startVertex
    const chain: number[] = []

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (true) {
      const segs = adj.get(current)
      if (!segs) break

      const nextSeg = segs.find((s) => !visited.has(s))
      if (nextSeg === undefined) break

      visited.add(nextSeg)
      chain.push(nextSeg)

      const seg = segments[nextSeg]
      current = seg.start === current ? seg.end : seg.start
    }

    if (chain.length > 0) chains.push(chain)
  }

  return chains
}

export function computeVectorBounds(network: VectorNetwork): Rect {
  if (network.vertices.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const v of network.vertices) {
    minX = Math.min(minX, v.x)
    minY = Math.min(minY, v.y)
    maxX = Math.max(maxX, v.x)
    maxY = Math.max(maxY, v.y)
  }

  // Also consider bezier control points for tighter bounds
  for (const seg of network.segments) {
    const start = network.vertices[seg.start]
    const end = network.vertices[seg.end]
    const cp1x = start.x + seg.tangentStart.x
    const cp1y = start.y + seg.tangentStart.y
    const cp2x = end.x + seg.tangentEnd.x
    const cp2y = end.y + seg.tangentEnd.y

    minX = Math.min(minX, cp1x, cp2x)
    minY = Math.min(minY, cp1y, cp2y)
    maxX = Math.max(maxX, cp1x, cp2x)
    maxY = Math.max(maxY, cp1y, cp2y)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_CUBIC_TO = 4

export function geometryBlobToPath(
  ck: CanvasKit,
  blob: Uint8Array,
  windingRule: WindingRule
): Path {
  const path = new ck.Path()
  if (!(blob.buffer instanceof ArrayBuffer)) return path
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
        return path
    }
  }

  path.setFillType(windingRule === 'EVENODD' ? ck.FillType.EvenOdd : ck.FillType.Winding)
  return path
}
