import type {
  SceneNode,
  VectorNetwork,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'

import { nodeHasRadius } from '#core/canvas/shapes'

const CMD_CLOSE = 0
const CMD_MOVE_TO = 1
const CMD_LINE_TO = 2
const CMD_QUAD_TO = 3
const CMD_CUBIC_TO = 4

export function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

function coordinate(value: number, decimals: number | null): number {
  return decimals === null ? value : round(value, decimals)
}

export function geometryBlobToSVGPath(blob: Uint8Array, decimals: number | null = 2): string {
  if (blob.length === 0) return ''
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0
  const parts: string[] = []

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case CMD_CLOSE:
        parts.push('Z')
        break
      case CMD_MOVE_TO: {
        const x = coordinate(dv.getFloat32(o, true), decimals)
        const y = coordinate(dv.getFloat32(o + 4, true), decimals)
        o += 8
        parts.push(`M${x} ${y}`)
        break
      }
      case CMD_LINE_TO: {
        const x = coordinate(dv.getFloat32(o, true), decimals)
        const y = coordinate(dv.getFloat32(o + 4, true), decimals)
        o += 8
        parts.push(`L${x} ${y}`)
        break
      }
      case CMD_QUAD_TO: {
        const x1 = coordinate(dv.getFloat32(o, true), decimals)
        const y1 = coordinate(dv.getFloat32(o + 4, true), decimals)
        const x = coordinate(dv.getFloat32(o + 8, true), decimals)
        const y = coordinate(dv.getFloat32(o + 12, true), decimals)
        o += 16
        parts.push(`Q${x1} ${y1} ${x} ${y}`)
        break
      }
      case CMD_CUBIC_TO: {
        const x1 = coordinate(dv.getFloat32(o, true), decimals)
        const y1 = coordinate(dv.getFloat32(o + 4, true), decimals)
        const x2 = coordinate(dv.getFloat32(o + 8, true), decimals)
        const y2 = coordinate(dv.getFloat32(o + 12, true), decimals)
        const x = coordinate(dv.getFloat32(o + 16, true), decimals)
        const y = coordinate(dv.getFloat32(o + 20, true), decimals)
        o += 24
        parts.push(`C${x1} ${y1} ${x2} ${y2} ${x} ${y}`)
        break
      }
      default:
        return parts.join('')
    }
  }

  return parts.join('')
}

function segmentToSVG(
  seg: VectorSegment,
  vertices: VectorVertex[],
  forward: boolean,
  decimals: number | null
): string {
  const start = forward ? vertices[seg.start] : vertices[seg.end]
  const end = forward ? vertices[seg.end] : vertices[seg.start]
  const ts = forward ? seg.tangentStart : { x: -seg.tangentEnd.x, y: -seg.tangentEnd.y }
  const te = forward ? seg.tangentEnd : { x: -seg.tangentStart.x, y: -seg.tangentStart.y }

  const isStraight =
    Math.abs(ts.x) < 0.001 &&
    Math.abs(ts.y) < 0.001 &&
    Math.abs(te.x) < 0.001 &&
    Math.abs(te.y) < 0.001

  if (isStraight) {
    return `L${coordinate(end.x, decimals)} ${coordinate(end.y, decimals)}`
  }

  const cp1x = coordinate(start.x + ts.x, decimals)
  const cp1y = coordinate(start.y + ts.y, decimals)
  const cp2x = coordinate(end.x + te.x, decimals)
  const cp2y = coordinate(end.y + te.y, decimals)
  return `C${cp1x} ${cp1y} ${cp2x} ${cp2y} ${coordinate(end.x, decimals)} ${coordinate(end.y, decimals)}`
}

function traceOrderedSegments(
  segmentIndices: readonly number[],
  segments: VectorSegment[],
  vertices: VectorVertex[],
  decimals: number | null
): string {
  if (segmentIndices.length === 0) return ''
  const first = segments[segmentIndices[0]]
  const second = segmentIndices.length > 1 ? segments[segmentIndices[1]] : null
  // Start at the first segment endpoint that does not connect to the second segment.
  const secondConnectsStart = second?.start === first.start || second?.end === first.start
  const secondConnectsEnd = second?.start === first.end || second?.end === first.end
  const firstForward = !second || secondConnectsEnd || !secondConnectsStart
  const startIndex = firstForward ? first.start : first.end
  let currentIndex = startIndex
  const parts = [
    `M${coordinate(vertices[startIndex].x, decimals)} ${coordinate(vertices[startIndex].y, decimals)}`
  ]

  for (const segmentIndex of segmentIndices) {
    const segment = segments[segmentIndex]
    const isConnected = segment.start === currentIndex || segment.end === currentIndex
    const forward = segment.start === currentIndex || !isConnected
    if (!isConnected) {
      const segmentStart = forward ? segment.start : segment.end
      parts.push(
        `M${coordinate(vertices[segmentStart].x, decimals)} ${coordinate(vertices[segmentStart].y, decimals)}`
      )
    }
    parts.push(segmentToSVG(segment, vertices, forward, decimals))
    currentIndex = forward ? segment.end : segment.start
  }
  if (parts.length === segmentIndices.length + 1 && currentIndex === startIndex) parts.push('Z')
  return parts.join('')
}

type SegmentAdjacency = ReadonlyMap<number, readonly number[]>

function buildSegmentAdjacency(segments: VectorSegment[]): SegmentAdjacency {
  const adjacency = new Map<number, number[]>()
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]
    for (const vertexIndex of [segment.start, segment.end]) {
      const incidentSegments = adjacency.get(vertexIndex)
      if (incidentSegments) incidentSegments.push(index)
      else adjacency.set(vertexIndex, [index])
    }
  }
  return adjacency
}

function findConnectedSegment(
  remaining: ReadonlySet<number>,
  adjacency: SegmentAdjacency,
  vertexIndex: number
): number | undefined {
  return adjacency.get(vertexIndex)?.find((index) => remaining.has(index))
}

function extendSegmentChain(
  chain: number[],
  startVertex: number,
  remaining: Set<number>,
  segments: VectorSegment[],
  adjacency: SegmentAdjacency
): void {
  let currentIndex = startVertex
  let nextIndex = findConnectedSegment(remaining, adjacency, currentIndex)
  while (nextIndex !== undefined) {
    chain.push(nextIndex)
    remaining.delete(nextIndex)
    const segment = segments[nextIndex]
    currentIndex = segment.start === currentIndex ? segment.end : segment.start
    nextIndex = findConnectedSegment(remaining, adjacency, currentIndex)
  }
}

function unfilledSegmentsToPath(network: VectorNetwork, decimals: number | null): string {
  const { vertices, segments } = network
  const remaining = new Set(segments.map((_, index) => index))
  const adjacency = buildSegmentAdjacency(segments)
  const parts: string[] = []

  while (remaining.size > 0) {
    const firstIndex = remaining.values().next().value
    if (firstIndex === undefined) break
    remaining.delete(firstIndex)
    const first = segments[firstIndex]

    const backward: number[] = []
    extendSegmentChain(backward, first.start, remaining, segments, adjacency)
    backward.reverse()

    const forward: number[] = []
    extendSegmentChain(forward, first.end, remaining, segments, adjacency)

    parts.push(
      traceOrderedSegments([...backward, firstIndex, ...forward], segments, vertices, decimals)
    )
  }

  return parts.join('')
}

export function vectorNetworkToSVGPaths(
  network: VectorNetwork,
  decimals: number | null = 2
): string[] {
  const { vertices, segments, regions } = network

  if (regions.length > 0) {
    return regions.map((region) =>
      region.loops.map((loop) => traceOrderedSegments(loop, segments, vertices, decimals)).join('')
    )
  }

  const path = unfilledSegmentsToPath(network, decimals)
  return path ? [path] : []
}

export function makePolygonPoints(node: SceneNode): string {
  return polygonVertices(node)
    .map((point) => `${round(point.x)},${round(point.y)}`)
    .join(' ')
}

export const hasRadius = nodeHasRadius

export function roundedRectPath(node: SceneNode): string {
  const w = node.width
  const h = node.height
  let tl: number, tr: number, br: number, bl: number
  if (node.independentCorners) {
    tl = node.topLeftRadius
    tr = node.topRightRadius
    br = node.bottomRightRadius
    bl = node.bottomLeftRadius
  } else {
    tl = tr = br = bl = node.cornerRadius
  }

  tl = Math.min(tl, w / 2, h / 2)
  tr = Math.min(tr, w / 2, h / 2)
  br = Math.min(br, w / 2, h / 2)
  bl = Math.min(bl, w / 2, h / 2)

  return [
    `M${round(tl)} 0`,
    `L${round(w - tr)} 0`,
    tr > 0 ? `A${round(tr)} ${round(tr)} 0 0 1 ${round(w)} ${round(tr)}` : '',
    `L${round(w)} ${round(h - br)}`,
    br > 0 ? `A${round(br)} ${round(br)} 0 0 1 ${round(w - br)} ${round(h)}` : '',
    `L${round(bl)} ${round(h)}`,
    bl > 0 ? `A${round(bl)} ${round(bl)} 0 0 1 0 ${round(h - bl)}` : '',
    `L0 ${round(tl)}`,
    tl > 0 ? `A${round(tl)} ${round(tl)} 0 0 1 ${round(tl)} 0` : '',
    'Z'
  ]
    .filter(Boolean)
    .join('')
}

export function arcPath(node: SceneNode): string {
  if (!node.arcData) return ''
  const { startingAngle, endingAngle, innerRadius } = node.arcData
  const cx = node.width / 2
  const cy = node.height / 2
  const rx = node.width / 2
  const ry = node.height / 2

  const fullCircle = Math.abs(endingAngle - startingAngle) >= Math.PI * 2 - 0.001
  if (fullCircle && innerRadius <= 0) {
    return `M${round(cx - rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx + rx)} ${round(cy)}A${round(rx)} ${round(ry)} 0 1 1 ${round(cx - rx)} ${round(cy)}Z`
  }

  const x1 = round(cx + rx * Math.cos(startingAngle))
  const y1 = round(cy + ry * Math.sin(startingAngle))
  const x2 = round(cx + rx * Math.cos(endingAngle))
  const y2 = round(cy + ry * Math.sin(endingAngle))
  const largeArc = Math.abs(endingAngle - startingAngle) > Math.PI ? 1 : 0
  const sweep = endingAngle > startingAngle ? 1 : 0

  const parts = [`M${x1} ${y1}`, `A${round(rx)} ${round(ry)} 0 ${largeArc} ${sweep} ${x2} ${y2}`]

  if (innerRadius > 0) {
    const irx = rx * innerRadius
    const iry = ry * innerRadius
    const ix1 = round(cx + irx * Math.cos(endingAngle))
    const iy1 = round(cy + iry * Math.sin(endingAngle))
    const ix2 = round(cx + irx * Math.cos(startingAngle))
    const iy2 = round(cy + iry * Math.sin(startingAngle))
    parts.push(`L${ix1} ${iy1}`)
    parts.push(`A${round(irx)} ${round(iry)} 0 ${largeArc} ${sweep === 1 ? 0 : 1} ${ix2} ${iy2}`)
    parts.push('Z')
  } else {
    parts.push(`L${round(cx)} ${round(cy)}Z`)
  }

  return parts.join('')
}
