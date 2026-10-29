import type { VectorSegment, VectorVertex } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

/** Anything path commands can be emitted into: a canvaskit Path or a blob encoder. */
export interface PathSink {
  moveTo(x: number, y: number): unknown
  lineTo(x: number, y: number): unknown
  cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): unknown
  close(): unknown
}

export function addSegmentDirected(
  path: PathSink,
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
    path.cubicTo(p0.x + te.x, p0.y + te.y, p3.x + ts.x, p3.y + ts.y, p3.x, p3.y)
  }
}

export function findChainStart(chain: number[], segments: VectorSegment[]): number {
  if (chain.length < 2) return segments[chain[0]].start

  const first = segments[chain[0]]
  const second = segments[chain[1]]
  if (first.start === second.start || first.start === second.end) return first.end
  return first.start
}

export function addLoopToPath(
  path: PathSink,
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

function isStraight(seg: VectorSegment): boolean {
  const { tangentStart: ts, tangentEnd: te } = seg
  return ts.x === 0 && ts.y === 0 && te.x === 0 && te.y === 0
}

/** Cubic handle length, as a fraction of the radius, of a circular arc turning by `angle`. */
function arcHandle(angle: number): number {
  return (4 / 3) * Math.tan(angle / 4)
}

interface RoundedCorner {
  /** Where the arc leaves the incoming segment and joins the outgoing one. */
  start: Vector
  end: Vector
  handleIn: Vector
  handleOut: Vector
}

/**
 * The arc rounding `corner` between straight runs from `from` and to `after`, or null when the
 * runs do not turn or have no length. A radius never takes more than half of either run.
 */
function roundedCorner(
  from: Vector,
  corner: Vector,
  after: Vector,
  radius: number
): RoundedCorner | null {
  const inLength = Math.hypot(corner.x - from.x, corner.y - from.y)
  const outLength = Math.hypot(after.x - corner.x, after.y - corner.y)
  if (radius <= 0 || inLength === 0 || outLength === 0) return null
  const inDir = { x: (corner.x - from.x) / inLength, y: (corner.y - from.y) / inLength }
  const outDir = { x: (after.x - corner.x) / outLength, y: (after.y - corner.y) / outLength }
  const turn = Math.acos(Math.max(-1, Math.min(1, inDir.x * outDir.x + inDir.y * outDir.y)))
  if (turn <= 1e-6) return null
  const reach = Math.min(radius * Math.tan(turn / 2), inLength / 2, outLength / 2)
  const handle = arcHandle(turn) * (reach / Math.tan(turn / 2))
  const start = { x: corner.x - inDir.x * reach, y: corner.y - inDir.y * reach }
  const end = { x: corner.x + outDir.x * reach, y: corner.y + outDir.y * reach }
  return {
    start,
    end,
    handleIn: { x: start.x + inDir.x * handle, y: start.y + inDir.y * handle },
    handleOut: { x: end.x - outDir.x * handle, y: end.y - outDir.y * handle }
  }
}

function drawCorner(path: PathSink, corner: RoundedCorner) {
  path.lineTo(corner.start.x, corner.start.y)
  path.cubicTo(
    corner.handleIn.x,
    corner.handleIn.y,
    corner.handleOut.x,
    corner.handleOut.y,
    corner.end.x,
    corner.end.y
  )
}

/**
 * Draws one chain, rounding each vertex where two straight segments meet by its corner radius, or
 * `cornerRadius` when it has none, as Figma rounds a vector's corners. A chain that comes back to
 * where it started is closed, its last corner rounded too.
 */
function addChainToPath(
  path: PathSink,
  chain: number[],
  segments: VectorSegment[],
  vertices: VectorVertex[],
  cornerRadius: number
): void {
  // The chain's vertices in drawing order; a closed chain ends where it started.
  const first = findChainStart(chain, segments)
  const order = [first]
  for (const segIdx of chain) {
    const seg = segments[segIdx]
    order.push(seg.start === order[order.length - 1] ? seg.end : seg.start)
  }
  const closed = chain.length > 2 && order[order.length - 1] === first
  const cornerAt = (index: number): RoundedCorner | null => {
    const incoming = segments[chain[index - 1]]
    const outgoing = segments[chain[index % chain.length]]
    if (!isStraight(incoming) || !isStraight(outgoing)) return null
    const corner = vertices[order[index]]
    return roundedCorner(
      vertices[order[index - 1]],
      corner,
      vertices[order[(index % chain.length) + 1]],
      corner.cornerRadius ?? cornerRadius
    )
  }
  const wrap = closed ? cornerAt(chain.length) : null
  const begin = wrap?.end ?? vertices[first]
  path.moveTo(begin.x, begin.y)
  for (let index = 0; index < chain.length; index++) {
    const last = index === chain.length - 1
    const corner = last ? wrap : cornerAt(index + 1)
    if (corner) {
      drawCorner(path, corner)
      continue
    }
    const seg = segments[chain[index]]
    addSegmentDirected(path, seg, vertices, seg.start === order[index])
  }
  if (closed) path.close()
}

export function addOpenSegmentsToPath(
  path: PathSink,
  segments: VectorSegment[],
  vertices: VectorVertex[],
  cornerRadius = 0
): void {
  const visited = new Set<number>()
  const chains = buildChains(segments)

  for (const chain of chains) {
    if (chain.length === 0) continue
    for (const segIdx of chain) visited.add(segIdx)
    addChainToPath(path, chain, segments, vertices, cornerRadius)
  }

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue
    const seg = segments[i]
    path.moveTo(vertices[seg.start].x, vertices[seg.start].y)
    addSegmentDirected(path, seg, vertices, true)
  }
}

export function buildChains(segments: VectorSegment[]): number[][] {
  if (segments.length === 0) return []

  const adj = new Map<number, number[]>()
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]
    const startList = adj.get(s.start) ?? []
    startList.push(i)
    adj.set(s.start, startList)

    const endList = adj.get(s.end) ?? []
    endList.push(i)
    adj.set(s.end, endList)
  }

  const visited = new Set<number>()
  const chains: number[][] = []
  const degree1 = [...adj.entries()].filter(([, segs]) => segs.length === 1).map(([v]) => v)
  const startVertices = degree1.length > 0 ? degree1 : [segments[0].start]

  for (const startVertex of startVertices) {
    let current = startVertex
    const chain: number[] = []

    for (;;) {
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

/** A stretch of a network's segments stroked as one contour, so its corners join. */
export interface StrokeRun {
  /** The vertex the run starts at. */
  start: number
  /** Segment indices in drawing order. */
  segments: number[]
  /** Whether the run comes back to its start, joining there instead of taking caps. */
  closed: boolean
}

/**
 * Segments chained into runs as Figma strokes a network: a run passes through every vertex
 * exactly two segments meet at, so its corners take the stroke's join and only its open ends take
 * caps. Runs stop at open ends and at junctions where three or more segments meet.
 */
export function strokeRuns(segments: VectorSegment[]): StrokeRun[] {
  const incident = new Map<number, number[]>()
  const meet = (vertex: number, index: number) => {
    const list = incident.get(vertex)
    if (list) list.push(index)
    else incident.set(vertex, [index])
  }
  for (const [index, segment] of segments.entries()) {
    meet(segment.start, index)
    if (segment.end !== segment.start) meet(segment.end, index)
  }
  const used = new Set<number>()
  const across = (index: number, vertex: number) =>
    segments[index].start === vertex ? segments[index].end : segments[index].start
  /** Extends a run through `vertex` for as long as two segments meet at each vertex reached. */
  const extend = (vertex: number, from: number, add: (index: number) => void) => {
    for (;;) {
      const meeting = incident.get(vertex)
      if (meeting?.length !== 2) return vertex
      const next = meeting[0] === from ? meeting[1] : meeting[0]
      if (used.has(next)) return vertex
      used.add(next)
      add(next)
      vertex = across(next, vertex)
      from = next
    }
  }

  const runs: StrokeRun[] = []
  for (const [first, segment] of segments.entries()) {
    if (used.has(first)) continue
    used.add(first)
    const run = [first]
    const end = extend(segment.end, first, (index) => run.push(index))
    if (end === segment.start) {
      runs.push({ start: segment.start, segments: run, closed: true })
      continue
    }
    const start = extend(segment.start, first, (index) => run.unshift(index))
    // A loop through a junction stops at it from both sides; it still closes there, whichever
    // of its segments is stored first.
    runs.push({ start, segments: run, closed: start === end })
  }
  return runs
}

/** Emits a stroke run as one contour, closed when the run comes back to its start. */
export function addStrokeRunToPath(
  path: PathSink,
  run: StrokeRun,
  segments: VectorSegment[],
  vertices: VectorVertex[]
): void {
  let current = run.start
  path.moveTo(vertices[current].x, vertices[current].y)
  for (const index of run.segments) {
    const segment = segments[index]
    const forward = segment.start === current
    addSegmentDirected(path, segment, vertices, forward)
    current = forward ? segment.end : segment.start
  }
  if (run.closed) path.close()
}
