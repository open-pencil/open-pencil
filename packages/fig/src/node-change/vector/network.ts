import type { Paint } from '@open-pencil/kiwi/fig/codec'
import type {
  HandleMirroring,
  VectorNetwork,
  VectorRegion,
  VectorSegment,
  VectorVertex,
  WindingRule
} from '@open-pencil/scene-graph'

export interface StyleOverride {
  styleID: number
  handleMirroring?: string
  strokeCap?: string
  fillPaints?: Paint[]
}

export function decodeVectorNetworkBlob(
  data: Uint8Array,
  styleOverrideTable?: StyleOverride[]
): VectorNetwork {
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
    vertices.push(vertex)
  }

  const segments: VectorSegment[] = []
  for (let index = 0; index < segmentCount; index++) {
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
    const windingRule: WindingRule = view.getUint32(offset, true) === 0 ? 'EVENODD' : 'NONZERO'
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
    regions.push({ windingRule, loops })
  }

  return { vertices, segments, regions }
}

function vertexStyleKey(vertex: VectorVertex): string {
  return `${vertex.handleMirroring ?? 'NONE'}|${vertex.strokeCap ?? ''}`
}

export function buildStyleOverrideTable(network: VectorNetwork): {
  table: StyleOverride[]
  styleToId: Map<string, number>
} {
  const styleToId = new Map<string, number>()
  const table: StyleOverride[] = []
  let nextId = 1
  for (const vertex of network.vertices) {
    const mirroring = vertex.handleMirroring ?? 'NONE'
    if (mirroring === 'NONE' && !vertex.strokeCap) continue
    const key = vertexStyleKey(vertex)
    if (styleToId.has(key)) continue
    styleToId.set(key, nextId)
    const entry: StyleOverride = { styleID: nextId }
    if (mirroring !== 'NONE') entry.handleMirroring = mirroring
    if (vertex.strokeCap) entry.strokeCap = vertex.strokeCap
    table.push(entry)
    nextId++
  }
  return { table, styleToId }
}

export function encodeVectorNetworkBlob(
  network: VectorNetwork,
  styleToId?: Map<string, number>
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

  for (const region of network.regions) {
    view.setUint32(offset, region.windingRule === 'EVENODD' ? 0 : 1, true)
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
