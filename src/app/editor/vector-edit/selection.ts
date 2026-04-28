import { breakAtVertex, deleteVertex } from '@open-pencil/core/vector'

import { getLiveNetwork, setNodeEditNetwork } from './network'

import type { VectorEditState } from './types'
import type { Editor } from '@open-pencil/core/editor'

export function createVectorEditSelectionActions(editor: Editor, state: VectorEditState) {
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
    }
    editor.requestRepaint()
  }

  function nodeEditAlignVertices(axis: 'horizontal' | 'vertical', align: 'min' | 'center' | 'max') {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size < 2) return

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
    let live = getLiveNetwork(es)

    for (const key of es.selectedHandles) {
      const [siStr, tf] = key.split(':')
      const si = Number(siStr)
      const seg = live.segments[si]
      if (tf === 'tangentStart') seg.tangentStart = { x: 0, y: 0 }
      else seg.tangentEnd = { x: 0, y: 0 }
    }

    const verticesToDelete = [...es.selectedVertexIndices].sort((a, b) => b - a)
    for (const vi of verticesToDelete) {
      const next = deleteVertex(live, vi)
      if (!next) break
      live = next
    }

    setNodeEditNetwork(es, live)
    es.selectedVertexIndices = new Set()
    es.selectedHandles = new Set()
    editor.requestRender()
  }

  function nodeEditBreakAtVertex() {
    const es = getNodeEditState()
    if (!es || es.selectedVertexIndices.size === 0) return
    const [vertexIndex] = es.selectedVertexIndices
    const live = getLiveNetwork(es)
    const next = breakAtVertex(live, vertexIndex)
    setNodeEditNetwork(es, next)
    es.selectedHandles = new Set()
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
