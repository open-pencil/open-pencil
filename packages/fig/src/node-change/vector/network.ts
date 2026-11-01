import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type {
  HandleMirroring,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex,
  WindingRule
} from '@open-pencil/scene-graph'

import { convertFills, fillToKiwiPaint } from '../paint'

export interface StyleOverride {
  styleID: number
  handleMirroring?: string
  strokeCap?: string
  strokeJoin?: string
  cornerRadius?: number
  fillPaints?: Paint[]
}

export function decodeVectorNetworkBlob(
  data: Uint8Array,
  styleOverrideTable?: StyleOverride[]
): VectorNetwork {
  return readVectorNetworkBlob(data, styleOverrideTable).network
}

/** The network a blob holds, with each segment's style word, which the network itself drops. */
function readVectorNetworkBlob(
  data: Uint8Array,
  styleOverrideTable?: StyleOverride[]
): { network: VectorNetwork; segmentStyles: number[] } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0

  const vertexCount = view.getUint32(offset, true)
  offset += 4
  const segmentCount = view.getUint32(offset, true)
  offset += 4
  const regionCount = view.getUint32(offset, true)
  offset += 4

  const styles = new Map<number, StyleOverride>()
  for (const entry of styleOverrideTable ?? []) styles.set(entry.styleID, entry)

  const vertices: VectorVertex[] = []
  for (let index = 0; index < vertexCount; index++) {
    const styleIndex = view.getUint32(offset, true)
    offset += 4
    const x = view.getFloat32(offset, true)
    offset += 4
    const y = view.getFloat32(offset, true)
    offset += 4
    const style = styles.get(styleIndex)
    const vertex: VectorVertex = {
      x,
      y,
      handleMirroring: (style?.handleMirroring as HandleMirroring | undefined) ?? 'NONE'
    }
    if (style?.strokeCap) vertex.strokeCap = style.strokeCap
    if (style?.strokeJoin) vertex.strokeJoin = style.strokeJoin
    if (style?.cornerRadius !== undefined) vertex.cornerRadius = style.cornerRadius
    vertices.push(vertex)
  }

  const segments: VectorSegment[] = []
  const segmentStyles: number[] = []
  for (let index = 0; index < segmentCount; index++) {
    segmentStyles.push(view.getUint32(offset, true))
    offset += 4
    const start = view.getUint32(offset, true)
    offset += 4
    const tangentStartX = view.getFloat32(offset, true)
    offset += 4
    const tangentStartY = view.getFloat32(offset, true)
    offset += 4
    const end = view.getUint32(offset, true)
    offset += 4
    const tangentEndX = view.getFloat32(offset, true)
    offset += 4
    const tangentEndY = view.getFloat32(offset, true)
    offset += 4
    segments.push({
      start,
      end,
      tangentStart: { x: tangentStartX, y: tangentStartY },
      tangentEnd: { x: tangentEndX, y: tangentEndY }
    })
  }

  const regions: VectorRegion[] = []
  for (let index = 0; index < regionCount; index++) {
    // The low bit is the winding rule; the rest is the region's style ID, which names its fill.
    const word = view.getUint32(offset, true)
    const windingRule: WindingRule = (word & 1) === 1 ? 'NONZERO' : 'EVENODD'
    // An entry without paints is a region filled with nothing, not one that takes the layer's.
    const paints = styles.get(word >>> 1)?.fillPaints
    offset += 4
    const loopCount = view.getUint32(offset, true)
    offset += 4
    const loops: number[][] = []
    for (let loopIndex = 0; loopIndex < loopCount; loopIndex++) {
      const segmentIndexCount = view.getUint32(offset, true)
      offset += 4
      const loop: number[] = []
      for (let segmentIndex = 0; segmentIndex < segmentIndexCount; segmentIndex++) {
        loop.push(view.getUint32(offset, true))
        offset += 4
      }
      loops.push(loop)
    }
    const region: VectorRegion = { windingRule, loops }
    if (paints) region.fills = convertFills(paints)
    regions.push(region)
  }

  return { network: { vertices, segments, regions }, segmentStyles }
}

function vertexStyleKey(vertex: VectorVertex): string {
  return [
    vertex.handleMirroring ?? 'NONE',
    vertex.strokeCap ?? '',
    vertex.strokeJoin ?? '',
    vertex.cornerRadius ?? ''
  ].join('|')
}

/**
 * The style overrides a network's vertices and regions name: vertex entries are shared by equal
 * styles, and each region with paints of its own gets an entry, as Figma writes them.
 */
export function buildStyleOverrideTable(network: VectorNetwork): {
  table: StyleOverride[]
  styleToId: Map<string, number>
  regionStyleIds: number[]
} {
  const styleToId = new Map<string, number>()
  const table: StyleOverride[] = []
  let nextId = 1
  for (const vertex of network.vertices) {
    const mirroring = vertex.handleMirroring ?? 'NONE'
    if (
      mirroring === 'NONE' &&
      !vertex.strokeCap &&
      !vertex.strokeJoin &&
      vertex.cornerRadius === undefined
    )
      continue
    const key = vertexStyleKey(vertex)
    if (styleToId.has(key)) continue
    styleToId.set(key, nextId)
    const entry: StyleOverride = { styleID: nextId }
    if (mirroring !== 'NONE') entry.handleMirroring = mirroring
    if (vertex.strokeCap) entry.strokeCap = vertex.strokeCap
    if (vertex.strokeJoin) entry.strokeJoin = vertex.strokeJoin
    if (vertex.cornerRadius !== undefined) entry.cornerRadius = vertex.cornerRadius
    table.push(entry)
    nextId++
  }
  const regionStyleIds = network.regions.map((region) => {
    if (!region.fills) return 0
    table.push({ styleID: nextId, fillPaints: region.fills.map(fillToKiwiPaint) })
    return nextId++
  })
  return { table, styleToId, regionStyleIds }
}

/**
 * Encodes a network as Figma's vector network blob. `regionStyleIds[i]` names the style override
 * that fills region `i`; Figma rebuilds a region's fill from it when the vector is edited.
 */
export function encodeVectorNetworkBlob(
  network: VectorNetwork,
  styleToId?: Map<string, number>,
  regionStyleIds?: readonly number[]
): Uint8Array {
  let regionBytes = 0
  for (const region of network.regions) {
    regionBytes += 8
    for (const loop of region.loops) regionBytes += 4 + loop.length * 4
  }

  const buffer = new ArrayBuffer(
    12 + network.vertices.length * 12 + network.segments.length * 28 + regionBytes
  )
  const view = new DataView(buffer)
  let offset = 0
  view.setUint32(offset, network.vertices.length, true)
  offset += 4
  view.setUint32(offset, network.segments.length, true)
  offset += 4
  view.setUint32(offset, network.regions.length, true)
  offset += 4

  for (const vertex of network.vertices) {
    view.setUint32(offset, styleToId?.get(vertexStyleKey(vertex)) ?? 0, true)
    offset += 4
    view.setFloat32(offset, vertex.x, true)
    offset += 4
    view.setFloat32(offset, vertex.y, true)
    offset += 4
  }

  for (const segment of network.segments) {
    view.setUint32(offset, 0, true)
    offset += 4
    view.setUint32(offset, segment.start, true)
    offset += 4
    view.setFloat32(offset, segment.tangentStart.x, true)
    offset += 4
    view.setFloat32(offset, segment.tangentStart.y, true)
    offset += 4
    view.setUint32(offset, segment.end, true)
    offset += 4
    view.setFloat32(offset, segment.tangentEnd.x, true)
    offset += 4
    view.setFloat32(offset, segment.tangentEnd.y, true)
    offset += 4
  }

  for (const [index, region] of network.regions.entries()) {
    // The low bit is the winding rule; the rest is the region's style ID.
    const styleID = regionStyleIds?.[index] ?? 0
    view.setUint32(offset, (styleID << 1) | (region.windingRule === 'EVENODD' ? 0 : 1), true)
    offset += 4
    view.setUint32(offset, region.loops.length, true)
    offset += 4
    for (const loop of region.loops) {
      view.setUint32(offset, loop.length, true)
      offset += 4
      for (const segmentIndex of loop) {
        view.setUint32(offset, segmentIndex, true)
        offset += 4
      }
    }
  }

  return new Uint8Array(buffer)
}

/** The style word Figma writes on the one segment a text path starts on. */
const TEXT_PATH_START_SEGMENT = 0x1ffffff

/**
 * The segment a text path starts on: Figma marks it by writing {@link TEXT_PATH_START_SEGMENT}
 * as its style word, and `textPathStart.tValue` is the position within it. Segment 0 when none is
 * marked, as in Figma.
 */
export function textPathStartSegment(blob: Uint8Array): number {
  const { segmentStyles } = readVectorNetworkBlob(blob)
  const index = segmentStyles.findIndex(
    (word) => (word & TEXT_PATH_START_SEGMENT) === TEXT_PATH_START_SEGMENT
  )
  return Math.max(index, 0)
}
