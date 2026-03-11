import svgpath from 'svgpath'

import type { VectorNetwork, VectorVertex, VectorSegment, VectorRegion, WindingRule } from './scene-graph'

interface SubPath {
  startVertexIndex: number
  segmentIndices: number[]
  closed: boolean
}

/**
 * Parse an SVG path `d` attribute into a VectorNetwork.
 *
 * Uses `svgpath` to normalize all commands to absolute M/L/C/Z
 * (arcs → cubics via `.unarc()`, smooth curves → explicit via `.unshort()`).
 */
export function parseSVGPath(d: string, windingRule: WindingRule = 'NONZERO'): VectorNetwork {
  const vertices: VectorVertex[] = []
  const segments: VectorSegment[] = []
  const subPaths: SubPath[] = []

  let currentSubPath: SubPath | null = null
  let cx = 0
  let cy = 0

  const vertexMap = new Map<string, number>()

  function getOrCreateVertex(x: number, y: number): number {
    const key = `${x},${y}`
    const existing = vertexMap.get(key)
    if (existing !== undefined) return existing
    const idx = vertices.length
    vertices.push({ x, y })
    vertexMap.set(key, idx)
    return idx
  }

  function addSegment(
    x1: number, y1: number,
    x2: number, y2: number,
    tx1: number, ty1: number,
    tx2: number, ty2: number
  ): void {
    const startIdx = getOrCreateVertex(x1, y1)
    const endIdx = getOrCreateVertex(x2, y2)
    const segIdx = segments.length
    segments.push({
      start: startIdx,
      end: endIdx,
      tangentStart: { x: tx1 - x1, y: ty1 - y1 },
      tangentEnd: { x: tx2 - x2, y: ty2 - y2 }
    })
    if (currentSubPath) {
      currentSubPath.segmentIndices.push(segIdx)
    }
  }

  function addLine(x1: number, y1: number, x2: number, y2: number): void {
    addSegment(x1, y1, x2, y2, x1, y1, x2, y2)
  }

  function addCubic(
    x1: number, y1: number,
    cp1x: number, cp1y: number,
    cp2x: number, cp2y: number,
    x2: number, y2: number
  ): void {
    addSegment(x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y)
  }

  const normalized = svgpath(d).abs().unshort().unarc()

  normalized.iterate((seg) => {
    const cmd = seg[0]

    if (cmd === 'M') {
      cx = seg[1]
      cy = seg[2]
      currentSubPath = {
        startVertexIndex: getOrCreateVertex(cx, cy),
        segmentIndices: [],
        closed: false
      }
      subPaths.push(currentSubPath)
    } else if (cmd === 'L') {
      addLine(cx, cy, seg[1], seg[2])
      cx = seg[1]
      cy = seg[2]
    } else if (cmd === 'H') {
      addLine(cx, cy, seg[1], cy)
      cx = seg[1]
    } else if (cmd === 'V') {
      addLine(cx, cy, cx, seg[1])
      cy = seg[1]
    } else if (cmd === 'C') {
      addCubic(cx, cy, seg[1], seg[2], seg[3], seg[4], seg[5], seg[6])
      cx = seg[5]
      cy = seg[6]
    } else if (cmd === 'Q') {
      const qx = seg[1]
      const qy = seg[2]
      const ex = seg[3]
      const ey = seg[4]
      const cp1x = cx + (2 / 3) * (qx - cx)
      const cp1y = cy + (2 / 3) * (qy - cy)
      const cp2x = ex + (2 / 3) * (qx - ex)
      const cp2y = ey + (2 / 3) * (qy - ey)
      addCubic(cx, cy, cp1x, cp1y, cp2x, cp2y, ex, ey)
      cx = ex
      cy = ey
    } else if (cmd === 'Z' || cmd === 'z') {
      if (currentSubPath) {
        const startVert = vertices[currentSubPath.startVertexIndex]
        if (Math.abs(cx - startVert.x) > 0.001 || Math.abs(cy - startVert.y) > 0.001) {
          addLine(cx, cy, startVert.x, startVert.y)
        }
        currentSubPath.closed = true
        cx = startVert.x
        cy = startVert.y
      }
    }
  })

  const regions: VectorRegion[] = []
  const closedPaths = subPaths.filter((sp) => sp.closed && sp.segmentIndices.length > 0)
  if (closedPaths.length > 0) {
    regions.push({
      windingRule,
      loops: closedPaths.map((sp) => sp.segmentIndices)
    })
  }

  return { vertices, segments, regions }
}
