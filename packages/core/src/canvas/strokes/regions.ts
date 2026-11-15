import { clamp } from 'es-toolkit'

import type { Path } from '@open-pencil/canvaskit'
import type { SceneNode, VectorNetwork } from '@open-pencil/scene-graph'
import { addStrokeRunToPath, strokeRuns } from '@open-pencil/scene-graph/paths'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { unitedPath } from '#core/canvas/paths/union'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

import { getStrokeCapEntity, getStrokeJoinEntity } from './draw'

type Stroke = SceneNode['strokes'][0]
type Partners = Map<number, Map<number, number>>
type FillTest = (x: number, y: number) => boolean

const GAP_PROBE_DISTANCE = 0.25

function regionsPerSegment(network: VectorNetwork): number[] {
  const counts = network.segments.map(() => 0)
  for (const region of network.regions) {
    for (const index of new Set(region.loops.flat())) {
      counts[index]++
    }
  }
  return counts
}

function leavingDirection(network: VectorNetwork, segmentIndex: number, vertex: number): Vector {
  const segment = network.segments[segmentIndex]
  const forward = segment.start === vertex
  const handle = forward ? segment.tangentStart : segment.tangentEnd
  if (handle.x !== 0 || handle.y !== 0) {
    return handle
  }
  const from = network.vertices[vertex]
  const to = network.vertices[forward ? segment.end : segment.start]
  return { x: to.x - from.x, y: to.y - from.y }
}

function holdsPoint(bounds: Float32Array, x: number, y: number): boolean {
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]
}

function enclosingBounds(boxes: Float32Array[]): Float32Array {
  const enclosing = Float32Array.of(Infinity, Infinity, -Infinity, -Infinity)
  for (const box of boxes) {
    enclosing[0] = Math.min(enclosing[0], box[0])
    enclosing[1] = Math.min(enclosing[1], box[1])
    enclosing[2] = Math.max(enclosing[2], box[2])
    enclosing[3] = Math.max(enclosing[3], box[3])
  }
  return enclosing
}

function indexedFillTest(fills: Path[]): FillTest {
  const bounds = fills.map((fill) => fill.getBounds())
  const enclosing = enclosingBounds(bounds)
  const side = Math.max(1, Math.ceil(Math.sqrt(fills.length)))
  const cellWidth = (enclosing[2] - enclosing[0]) / side || 1
  const cellHeight = (enclosing[3] - enclosing[1]) / side || 1
  const column = (x: number) => clamp(Math.floor((x - enclosing[0]) / cellWidth), 0, side - 1)
  const row = (y: number) => clamp(Math.floor((y - enclosing[1]) / cellHeight), 0, side - 1)
  const buckets: number[][] = Array.from({ length: side * side }, () => [])
  for (const [index, box] of bounds.entries()) {
    for (let y = row(box[1]); y <= row(box[3]); y++) {
      for (let x = column(box[0]); x <= column(box[2]); x++) {
        buckets[y * side + x].push(index)
      }
    }
  }
  return (x, y) =>
    holdsPoint(enclosing, x, y) &&
    buckets[row(y) * side + column(x)].some(
      (index) => holdsPoint(bounds[index], x, y) && fills[index].contains(x, y)
    )
}

function regionSegmentsByVertex(network: VectorNetwork, counts: number[]): Map<number, number[]> {
  const byVertex = new Map<number, number[]>()
  const meet = (vertex: number, index: number) => {
    const list = byVertex.get(vertex)
    if (list) {
      list.push(index)
    } else {
      byVertex.set(vertex, [index])
    }
  }
  for (const [index, segment] of network.segments.entries()) {
    if (counts[index] === 0 || segment.start === segment.end) {
      continue
    }
    meet(segment.start, index)
    meet(segment.end, index)
  }
  return byVertex
}

function pairAcrossUnfilledGaps(
  network: VectorNetwork,
  vertex: number,
  meeting: number[],
  isFilled: FillTest
): Map<number, number> {
  const ends = meeting
    .map((segment) => {
      const direction = leavingDirection(network, segment, vertex)
      return {
        segment,
        angle: Math.atan2(direction.y, direction.x),
        reach: Math.hypot(direction.x, direction.y)
      }
    })
    .sort((a, b) => a.angle - b.angle)
  const origin = network.vertices[vertex]
  const partners = new Map<number, number>()
  for (const [index, end] of ends.entries()) {
    const next = ends[(index + 1) % ends.length]
    if (partners.has(end.segment) || partners.has(next.segment)) {
      continue
    }
    const sweep = (next.angle - end.angle + 2 * Math.PI) % (2 * Math.PI) || 2 * Math.PI
    const middle = end.angle + sweep / 2
    const distance = Math.min(GAP_PROBE_DISTANCE, end.reach / 2, next.reach / 2)
    const gapFilled = isFilled(
      origin.x + Math.cos(middle) * distance,
      origin.y + Math.sin(middle) * distance
    )
    if (!gapFilled) {
      partners.set(end.segment, next.segment)
      partners.set(next.segment, end.segment)
    }
  }
  return partners
}

function outlinePartners(network: VectorNetwork, counts: number[], isFilled: FillTest): Partners {
  const partners: Partners = new Map()
  for (const [vertex, meeting] of regionSegmentsByVertex(network, counts)) {
    if (meeting.length === 2) {
      partners.set(
        vertex,
        new Map([
          [meeting[0], meeting[1]],
          [meeting[1], meeting[0]]
        ])
      )
    } else if (meeting.length > 2) {
      partners.set(vertex, pairAcrossUnfilledGaps(network, vertex, meeting, isFilled))
    }
  }
  return partners
}

function strokedSegments(
  r: SkiaRenderer,
  network: VectorNetwork,
  members: number[],
  partners: Partners,
  options: Parameters<Path['makeStroked']>[0]
): Path | null {
  if (members.length === 0) {
    return null
  }
  const local = new Map(members.map((segment, index) => [segment, index]))
  const segments = members.map((index) => network.segments[index])
  const runs = strokeRuns(segments, (vertex, from) => {
    const partner = partners.get(vertex)?.get(members[from])
    return partner === undefined ? undefined : local.get(partner)
  })
  const builder = new r.ck.PathBuilder()
  for (const run of runs) {
    addStrokeRunToPath(builder, run, segments, network.vertices)
  }
  const centerline = builder.detachAndDelete()
  const outline = centerline.makeStroked(options)
  centerline.delete()
  return outline
}

function mergedNonzero(r: SkiaRenderer, outlines: Path[]): Path {
  const merged = new r.ck.PathBuilder()
  for (const outline of outlines) {
    merged.addPath(outline)
    outline.delete()
  }
  const path = merged.detachAndDelete()
  path.setFillType(r.ck.FillType.Winding)
  return path
}

// Figma strokes a segment several regions share at its own weight, even on a stroke taking a side.
export function regionStrokeOutline(
  r: SkiaRenderer,
  node: SceneNode,
  network: VectorNetwork,
  fills: Path[],
  stroke: Stroke,
  sided: boolean
): Path | null {
  const counts = regionsPerSegment(network)
  let fillTest: FillTest | null = null
  const isFilled: FillTest = (x, y) => {
    fillTest ??= indexedFillTest(fills)
    return fillTest(x, y)
  }
  const partners = outlinePartners(network, counts, isFilled)
  const options = (width: number) => ({
    width,
    miter_limit: node.strokeMiterLimit,
    cap: getStrokeCapEntity(r, 'NONE'),
    join: getStrokeJoinEntity(r, stroke.join ?? 'MITER')
  })
  const indexes = network.segments.map((_, index) => index)
  const bounding = indexes.filter((index) => counts[index] > 0)
  const ownedByOne = indexes.filter((index) => counts[index] === 1)
  const anyShared = ownedByOne.length < bounding.length
  const plain = !sided || anyShared ? bounding : []
  const doubled = sided ? ownedByOne : []
  const outlines = [
    strokedSegments(r, network, plain, partners, options(stroke.weight)),
    strokedSegments(r, network, doubled, partners, options(stroke.weight * 2))
  ].filter((outline) => outline !== null)
  // Skia's stroke outlines all wind the same way, so one nonzero path fills their overlaps once;
  // a PathOps union of them costs several times the whole render on large networks.
  return outlines.length > 1 ? mergedNonzero(r, outlines) : (outlines[0] ?? null)
}

function paintsStroke(stroke: Stroke): boolean {
  return stroke.visible && stroke.opacity > 0 && stroke.weight > 0
}

function regionBandArea(
  r: SkiaRenderer,
  node: SceneNode,
  network: VectorNetwork,
  closed: Path[],
  fill: Path | null,
  stroke: Stroke
): Path | null {
  const keptSide = stroke.align === 'INSIDE' ? r.ck.PathOp.Intersect : r.ck.PathOp.Difference
  const sided = stroke.align !== 'CENTER' && fill !== null
  const band = regionStrokeOutline(r, node, network, closed, stroke, sided)
  if (!band || !sided) {
    return band
  }
  const area = r.ck.Path.MakeFromOp(band, fill, keptSide)
  band.delete()
  return area
}

function openSegmentsArea(r: SkiaRenderer, node: SceneNode, open: Path[], stroke: Stroke): Path[] {
  const options = {
    width: stroke.weight,
    miter_limit: node.strokeMiterLimit,
    cap: getStrokeCapEntity(r, stroke.cap ?? 'NONE'),
    join: getStrokeJoinEntity(r, stroke.join ?? 'MITER')
  }
  return open.flatMap((path) => path.makeStroked(options) ?? [])
}

export function regionStrokeArea(
  r: SkiaRenderer,
  node: SceneNode,
  network: VectorNetwork,
  vectorPaths: Path[]
): Path | null {
  const closed = vectorPaths.slice(0, network.regions.length)
  const open = vectorPaths.slice(network.regions.length)
  const fill = unitedPath(r, closed)
  const pieces: Path[] = []
  for (const stroke of node.strokes.filter(paintsStroke)) {
    const band = regionBandArea(r, node, network, closed, fill, stroke)
    if (band) {
      pieces.push(band)
    }
    for (const segmentsArea of openSegmentsArea(r, node, open, stroke)) {
      pieces.push(segmentsArea)
    }
  }
  fill?.delete()
  if (pieces.length <= 1) {
    return pieces[0] ?? null
  }
  const united = unitedPath(r, pieces)
  for (const piece of pieces) {
    piece.delete()
  }
  return united
}
