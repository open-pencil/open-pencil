import { nearestPointOnNetwork, removeVertex, splitSegmentAt } from '@open-pencil/core/vector'

import type { NodeEditState, VectorEditState } from './types'
import type { Editor } from '@open-pencil/core/editor'
import type { VectorNetwork } from '@open-pencil/core/scene-graph'

export function setNodeEditNetwork(es: NodeEditState, network: VectorNetwork) {
  es.vertices = network.vertices.map((v) => ({ ...v }))
  es.segments = network.segments.map((s) => ({
    ...s,
    tangentStart: { ...s.tangentStart },
    tangentEnd: { ...s.tangentEnd }
  }))
  es.regions = network.regions.map((r) => ({
    windingRule: r.windingRule,
    loops: r.loops.map((l) => [...l])
  }))
}

export function getLiveNetwork(es: NodeEditState): VectorNetwork {
  return {
    vertices: es.vertices.map((v) => ({ ...v })),
    segments: es.segments.map((s) => ({
      ...s,
      tangentStart: { ...s.tangentStart },
      tangentEnd: { ...s.tangentEnd }
    })),
    regions: es.regions.map((r) => ({
      windingRule: r.windingRule,
      loops: r.loops.map((l) => [...l])
    }))
  }
}

export function createVectorEditNetworkActions(
  editor: Editor,
  state: VectorEditState,
  getNodeEditState: () => NodeEditState | null
) {
  const nodeEditHitThreshold = 8

  function nodeEditConnectEndpoints(a: number, b: number) {
    const es = getNodeEditState()
    if (!es || a === b) return
    if (a < 0 || b < 0 || a >= es.vertices.length || b >= es.vertices.length) return

    const removeIndex = a
    const keepIndex = b
    const remap = (idx: number): number => {
      if (idx === removeIndex) return keepIndex
      return idx > removeIndex ? idx - 1 : idx
    }

    const nextVertices = es.vertices.filter((_, idx) => idx !== removeIndex)
    const nextSegments = es.segments
      .map((seg) => ({
        ...seg,
        tangentStart: { ...seg.tangentStart },
        tangentEnd: { ...seg.tangentEnd },
        start: remap(seg.start),
        end: remap(seg.end)
      }))
      .filter((seg) => seg.start !== seg.end)

    setNodeEditNetwork(es, { vertices: nextVertices, segments: nextSegments, regions: [] })
    es.selectedVertexIndices = new Set([remap(keepIndex)])
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditAddVertex(cx: number, cy: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const nearest = nearestPointOnNetwork(cx, cy, live, nodeEditHitThreshold / state.zoom)
    if (!nearest) return
    const split = splitSegmentAt(live, nearest.segmentIndex, nearest.t)
    setNodeEditNetwork(es, split.network)
    es.selectedVertexIndices = new Set([split.newVertexIndex])
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditRemoveVertex(vertexIndex: number) {
    const es = getNodeEditState()
    if (!es) return
    const live = getLiveNetwork(es)
    const next = removeVertex(live, vertexIndex)
    if (!next) return
    setNodeEditNetwork(es, next)
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  return { nodeEditConnectEndpoints, nodeEditAddVertex, nodeEditRemoveVertex }
}
