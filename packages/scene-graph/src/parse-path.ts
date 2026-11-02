import svgpath from 'svgpath'

import type { VectorNetwork, VectorVertex, VectorSegment, VectorRegion, WindingRule } from './types'

interface SubPath {
  startVertexIndex: number
  segmentIndices: number[]
  closed: boolean
}

export type VectorPathWindingRule = WindingRule | 'NONE'

/** How far apart an end and its subpath's start can be from rounding alone. */
const CLOSING_ROUNDING = 1e-6
export type SVGPathParseResult = { ok: true; network: VectorNetwork } | { ok: false; error: string }

interface ParseOptions {
  includeOpenRegions: boolean
  strictCommands: boolean
}

/**
 * Parse an SVG path `d` attribute into a VectorNetwork.
 *
 * Uses `svgpath` to normalize all commands to absolute M/L/C/Z
 * (arcs → cubics via `.unarc()`, smooth curves → explicit via `.unshort()`).
 *
 * Only closed subpaths form the fill region unless `includeOpenRegions` is set. SVG fills every
 * subpath as if it were closed, so set it for a filled path to keep holes that an open subpath and
 * a closed one cut together under the path's fill rule.
 */
export function parseSVGPath(
  d: string,
  windingRule: WindingRule = 'NONZERO',
  options: { includeOpenRegions?: boolean } = {}
): VectorNetwork {
  const parsed = parsePath(d, windingRule, {
    includeOpenRegions: options.includeOpenRegions ?? false,
    strictCommands: false
  })
  return parsed.ok ? parsed.network : { vertices: [], segments: [], regions: [] }
}

/**
 * Parse a `d` with any command SVG has, its closed subpaths filled under `windingRule` and, with
 * `includeOpenRegions`, its open ones too, as SVG fills them. Unlike `parseSVGPath`, a path that
 * does not parse says why.
 */
export function parseSVGPathData(
  d: string,
  windingRule: WindingRule,
  options: { includeOpenRegions: boolean }
): SVGPathParseResult {
  return parsePath(d, windingRule, { ...options, strictCommands: false })
}

/** Parse the strict absolute command subset accepted by Figma's VectorPath API. */
export function parsePluginVectorPath(
  d: string,
  windingRule: VectorPathWindingRule
): SVGPathParseResult {
  return parsePath(d, windingRule, {
    includeOpenRegions: windingRule !== 'NONE',
    strictCommands: true
  })
}

function parsePath(
  d: string,
  windingRule: VectorPathWindingRule,
  options: ParseOptions
): SVGPathParseResult {
  const vertices: VectorVertex[] = []
  const segments: VectorSegment[] = []
  const subPaths: SubPath[] = []

  let currentSubPath: SubPath | null = null
  let cx = 0
  let cy = 0

  const vertexMap = new Map<string, number>()
  /** How many segment ends sit on each vertex. */
  const uses: number[] = []

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
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tx1: number,
    ty1: number,
    tx2: number,
    ty2: number
  ): void {
    const startIdx = getOrCreateVertex(x1, y1)
    const endIdx = getOrCreateVertex(x2, y2)
    uses[startIdx] = (uses[startIdx] ?? 0) + 1
    uses[endIdx] = (uses[endIdx] ?? 0) + 1
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
    x1: number,
    y1: number,
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x2: number,
    y2: number
  ): void {
    addSegment(x1, y1, x2, y2, cp1x, cp1y, cp2x, cp2y)
  }

  /**
   * A subpath that ends a hair off its start, as an arc turned into curves does, ends on the start
   * vertex, as Figma merges them; the point it ended on goes when no other segment uses it.
   */
  function closeOnStart(subPath: SubPath): void {
    const lastIndex = subPath.segmentIndices.at(-1)
    if (lastIndex === undefined) return
    const last = segments[lastIndex]
    if (last.end === subPath.startVertexIndex) return
    const stray = last.end
    last.end = subPath.startVertexIndex
    uses[subPath.startVertexIndex] += 1
    uses[stray] -= 1
    // Only the newest vertex can go without renumbering the others.
    if (uses[stray] > 0 || stray !== vertices.length - 1) return
    const point = vertices[stray]
    vertices.pop()
    uses.pop()
    vertexMap.delete(`${point.x},${point.y}`)
  }

  const parsed = svgpath(d)
  const parseError = 'err' in parsed && typeof parsed.err === 'string' ? parsed.err : null
  if (parseError) return { ok: false, error: parseError }
  if (options.strictCommands) {
    const unsupportedCommands = new Set<string>()
    parsed.iterate((segment) => {
      if (!['M', 'L', 'Q', 'C', 'Z'].includes(segment[0])) unsupportedCommands.add(segment[0])
    })
    const unsupportedCommand = unsupportedCommands.values().next().value
    if (unsupportedCommand !== undefined) {
      return { ok: false, error: `Unsupported path command ${unsupportedCommand}` }
    }
  }
  const normalized = parsed.abs().unshort().unarc()

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
        // Only rounding, such as an arc turned into curves leaves, merges an end into the start;
        // a point the path drew, however close, keeps its own closing segment.
        const rounding =
          Math.abs(cx - startVert.x) <= CLOSING_ROUNDING &&
          Math.abs(cy - startVert.y) <= CLOSING_ROUNDING
        if (rounding) closeOnStart(currentSubPath)
        else addLine(cx, cy, startVert.x, startVert.y)
        currentSubPath.closed = true
        cx = startVert.x
        cy = startVert.y
      }
    }
  })

  const regions: VectorRegion[] = []
  const regionPaths = subPaths.filter(
    (subPath) =>
      windingRule !== 'NONE' &&
      subPath.segmentIndices.length > 0 &&
      (subPath.closed || options.includeOpenRegions)
  )
  if (regionPaths.length > 0 && windingRule !== 'NONE') {
    regions.push({
      windingRule,
      loops: regionPaths.map((subPath) => subPath.segmentIndices)
    })
  }

  return { ok: true, network: { vertices, segments, regions } }
}
