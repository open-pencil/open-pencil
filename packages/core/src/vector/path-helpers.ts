import type { Path } from 'canvaskit-wasm'

import type { VectorSegment, VectorVertex } from '#core/scene-graph'

export function addSegmentDirected(
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

export function addOpenSegmentsToPath(
  path: Path,
  segments: VectorSegment[],
  vertices: VectorVertex[]
): void {
  const visited = new Set<number>()
  const chains = buildChains(segments)

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
