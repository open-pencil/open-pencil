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

import { computeAccurateBounds } from './bezier'

import type {
  HandleMirroring,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex,
  WindingRule
} from '#core/scene-graph'
import type { Rect, Vector } from '#core/types'
import type { CanvasKit, Path } from 'canvaskit-wasm'

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

/** Build a styleOverrideTable from vertex handleMirroring values.
 *  Returns a map from handleMirroring value to styleID, plus the table array. */
export function buildStyleOverrideTable(network: VectorNetwork): {
  table: StyleOverride[]
  mirroringToId: Map<string, number>
} {
  const mirroringToId = new Map<string, number>()
  const table: StyleOverride[] = []
  let nextId = 1

  for (const v of network.vertices) {
    const hm = v.handleMirroring ?? 'NONE'
    if (hm === 'NONE') continue
    if (!mirroringToId.has(hm)) {
      mirroringToId.set(hm, nextId)
      table.push({ styleID: nextId, handleMirroring: hm })
      nextId++
    }
  }

  return { table, mirroringToId }
}

export function encodeVectorNetworkBlob(
  network: VectorNetwork,
  mirroringToId?: Map<string, number>
): Uint8Array {
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
    const hm = v.handleMirroring ?? 'NONE'
    const styleIdx = (hm !== 'NONE' && mirroringToId?.get(hm)) || 0
    view.setUint32(o, styleIdx, true)
    o += 4
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

function fitCircleArc(
  pts: Vector[]
): { cx: number; cy: number; r: number; startAngleDeg: number; sweepDeg: number } | null {
  if (pts.length < 3) return null
  const p1 = pts[0]
  const p2 = pts[Math.floor(pts.length / 2)]
  const p3 = pts[pts.length - 1]
  const ax = p2.x - p1.x
  const ay = p2.y - p1.y
  const bx = p3.x - p1.x
  const by = p3.y - p1.y
  const d = 2 * (ax * by - ay * bx)
  if (Math.abs(d) < 1e-6) return null
  const sqA = ax * ax + ay * ay
  const sqB = bx * bx + by * by
  const ux = (by * sqA - ay * sqB) / d
  const uy = (ax * sqB - bx * sqA) / d
  const cx = p1.x + ux
  const cy = p1.y + uy
  const r = Math.hypot(ux, uy)
  if (!Number.isFinite(r) || r <= 0) return null

  const tol = Math.max(0.5, r * 0.01)
  for (const p of pts) {
    if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - r) > tol) return null
  }

  const startAngleDeg = (Math.atan2(p1.y - cy, p1.x - cx) * 180) / Math.PI
  const endAngleDeg = (Math.atan2(p3.y - cy, p3.x - cx) * 180) / Math.PI
  const midAngleDeg = (Math.atan2(p2.y - cy, p2.x - cx) * 180) / Math.PI

  const norm = (a: number): number => ((a % 360) + 360) % 360
  const sweepCW = norm(endAngleDeg - startAngleDeg)
  const sweepCCW = -norm(startAngleDeg - endAngleDeg)
  const midOnCW = norm(midAngleDeg - startAngleDeg) <= sweepCW
  const sweepDeg = midOnCW ? sweepCW : sweepCCW

  return { cx, cy, r, startAngleDeg, sweepDeg }
}

function isClosedThinCrescent(network: VectorNetwork): { ordered: number[] } | null {
  const { vertices, segments } = network
  const n = vertices.length
  if (n < 6 || n % 2 !== 0 || segments.length !== n) return null

  const adj = new Map<number, number[]>()
  const ensure = (k: number): number[] => {
    let v = adj.get(k)
    if (!v) {
      v = []
      adj.set(k, v)
    }
    return v
  }
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    ensure(s.start).push(i)
    ensure(s.end).push(i)
  }
  if (adj.size !== n) return null
  for (const segs of adj.values()) {
    if (segs.length !== 2) return null
  }

  const ordered: number[] = [0]
  const visited = new Set<number>()
  let current = 0
  while (ordered.length < n) {
    const segs = adj.get(current)
    if (!segs) return null
    const nextSeg = segs.find((s) => !visited.has(s))
    if (nextSeg === undefined) return null
    visited.add(nextSeg)
    const seg = segments[nextSeg]
    const next = seg.start === current ? seg.end : seg.start
    ordered.push(next)
    current = next
  }

  const half = n / 2
  const paired: number[] = []
  let alongSum = 0
  for (let i = 0; i < half; i++) {
    const a = vertices[ordered[i]]
    const b = vertices[ordered[n - 1 - i]]
    paired.push(Math.hypot(a.x - b.x, a.y - b.y))
  }
  for (let i = 0; i < half - 1; i++) {
    const a = vertices[ordered[i]]
    const b = vertices[ordered[i + 1]]
    alongSum += Math.hypot(a.x - b.x, a.y - b.y)
  }
  if (alongSum <= 0) return null

  const pairedAvg = paired.reduce((s, v) => s + v, 0) / half
  if (pairedAvg > alongSum * 0.5) return null

  const variance = paired.reduce((s, v) => s + (v - pairedAvg) ** 2, 0) / half
  const stdDev = Math.sqrt(variance)
  if (pairedAvg > 0 && stdDev / pairedAvg > 0.5) return null

  return { ordered }
}

export function vectorNetworkToCenterlinePath(ck: CanvasKit, network: VectorNetwork): Path {
  const { vertices, segments } = network

  const crescent = isClosedThinCrescent(network)
  if (crescent) {
    const { ordered } = crescent
    const cycleLen = ordered.length

    const segDir = (i: number): Vector => {
      const a = vertices[ordered[i]]
      const b = vertices[ordered[(i + 1) % cycleLen]]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const m = Math.hypot(dx, dy) || 1
      return { x: dx / m, y: dy / m }
    }
    const angleChangeAtVertex = (i: number): number => {
      const dIn = segDir((i - 1 + cycleLen) % cycleLen)
      const dOut = segDir(i)
      const dot = dIn.x * dOut.x + dIn.y * dOut.y
      return Math.acos(Math.max(-1, Math.min(1, dot)))
    }
    const cornerThreshold = Math.PI / 3
    const isCorner: boolean[] = []
    for (let i = 0; i < cycleLen; i++) {
      isCorner.push(angleChangeAtVertex(i) > cornerThreshold)
    }

    const caps: number[] = []
    for (let i = 0; i < cycleLen; i++) {
      const next = (i + 1) % cycleLen
      if (isCorner[i] && isCorner[next]) caps.push(i)
    }
    if (caps.length === 2) {
      const [cap1, cap2] = caps
      const buildSubchain = (afterCap: number, beforeCap: number): number[] => {
        const verts: number[] = []
        let i = (afterCap + 1) % cycleLen
        verts.push(ordered[i])
        while (i !== beforeCap) {
          i = (i + 1) % cycleLen
          verts.push(ordered[i])
        }
        return verts
      }
      const chainA = buildSubchain(cap1, cap2)
      const chainB = buildSubchain(cap2, cap1)

      const pairCount = Math.min(chainA.length, chainB.length)
      if (pairCount >= 2) {
        const midpoints: Vector[] = []
        for (let i = 0; i < pairCount; i++) {
          const a = vertices[chainA[i]]
          const b = vertices[chainB[chainB.length - 1 - i]]
          midpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
        }

        const arcParams = fitCircleArc(midpoints)
        if (arcParams) {
          const { cx, cy, r, startAngleDeg, sweepDeg } = arcParams
          const path = new ck.Path()
          path.addArc(ck.LTRBRect(cx - r, cy - r, cx + r, cy + r), startAngleDeg, sweepDeg)
          return path
        }

        const path = new ck.Path()
        path.moveTo(midpoints[0].x, midpoints[0].y)
        for (let i = 1; i < midpoints.length; i++) {
          path.lineTo(midpoints[i].x, midpoints[i].y)
        }
        return path
      }
    }
  }

  const path = new ck.Path()
  const visited = new Set<number>()
  const chains = buildChains(segments, vertices.length)

  for (const chain of chains) {
    if (chain.length === 0) continue
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

  return path
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
  return computeAccurateBounds(network)
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
