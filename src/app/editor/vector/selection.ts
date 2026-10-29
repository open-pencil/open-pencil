import type { Editor } from '@open-pencil/core'
import { breakAtVertex, deleteVectorParts, vectorHandleParts } from '@open-pencil/core/vector'

import { pushNodeEditHistory } from './history'
import { getLiveNetwork, setNodeEditNetwork } from './network'
import type { VectorEditState } from './types'

export function createVectorEditSelectionActions(
  editor: Editor,
  state: VectorEditState,
  exitNodeEditMode: (commit: boolean) => void
) {
  function getNodeEditState() {
    return state.nodeEditState
  }

  function nodeEditSelectVertex(vertexIndex: number, addToSelection: boolean) {
    const es = getNodeEditState()
    if (!es) return
    if (addToSelection) {
      const next = new Set(es.selectedVertexIndices)
      if (next.has(vertexIndex)) next.delete(vertexIndex)
      else next.add(vertexIndex)
      es.selectedVertexIndices = next
    } else {
      es.selectedVertexIndices = new Set([vertexIndex])
      es.selectedSegmentIndices = new Set()
      es.selectedRegions = new Set()
    }
    editor.requestRepaint()
  }

  function nodeEditAlignVertices(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max') {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size < 2) return
    pushNodeEditHistory(es)

    const indices = [...es.selectedVertexIndices]
    const prop = axis === 'horizontal' ? 'x' : 'y'

    let lo = Infinity
    let hi = -Infinity
    for (const i of indices) {
      const v = es.vertices[i][prop]
      if (v < lo) lo = v
      if (v > hi) hi = v
    }

    let target = (lo + hi) / 2
    if (align === 'min') target = lo
    else if (align === 'max') target = hi
    for (const i of indices) {
      es.vertices[i] = { ...es.vertices[i], [prop]: target }
    }
    editor.requestRepaint()
  }

  function nodeEditDeleteSelected() {
    const es = getNodeEditState()
    if (!es) return
    if (
      es.selectedHandles.size === 0 &&
      es.selectedVertexIndices.size === 0 &&
      es.selectedSegmentIndices.size === 0
    )
      return
    pushNodeEditHistory(es)
    let live = getLiveNetwork(es)

    for (const handleId of es.selectedHandles) {
      const handle = vectorHandleParts(handleId)
      if (!handle || handle.segmentIndex >= live.segments.length) continue
      const seg = live.segments[handle.segmentIndex]
      if (handle.tangentField === 'tangentStart') seg.tangentStart = { x: 0, y: 0 }
      else seg.tangentEnd = { x: 0, y: 0 }
    }

    live = deleteVectorParts(live, es.selectedSegmentIndices, es.selectedVertexIndices)
    // As in Figma, deleting every point deletes the layer. The edits made before it are committed
    // first, so undoing the delete brings back the path as it was just before.
    if (live.vertices.length === 0) {
      const { nodeId } = es
      exitNodeEditMode(true)
      editor.select([nodeId])
      editor.deleteSelected()
      return
    }

    setNodeEditNetwork(es, live)
    es.selectedVertexIndices = new Set()
    es.selectedSegmentIndices = new Set()
    es.selectedRegions = new Set()
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditBreakAtVertex() {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size === 0) return
    pushNodeEditHistory(es)
    const [vertexIndex] = es.selectedVertexIndices
    const live = getLiveNetwork(es)
    const next = breakAtVertex(live, vertexIndex)
    setNodeEditNetwork(es, next)
    es.selectedHandles = new Set()
    es.selectedSegmentIndices = new Set()
    es.selectedRegions = new Set()
    es.selectedVertexIndices = new Set([vertexIndex])
    editor.requestRender()
  }

  return {
    nodeEditSelectVertex,
    nodeEditAlignVertices,
    nodeEditDeleteSelected,
    nodeEditBreakAtVertex
  }
}
