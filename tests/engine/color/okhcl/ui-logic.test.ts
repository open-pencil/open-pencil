import { describe, expect, test } from 'bun:test'

import {
  clearNodeFillOkHCL,
  clearNodeStrokeOkHCL,
  getFillOkHCL,
  getStrokeOkHCL,
  SceneGraph,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'

describe('OkHCL metadata toggling', () => {
  test('can disable fill OkHCL metadata', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('FRAME', page.id, {
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 1, g: 0, b: 0, a: 1 } }]
    })

    graph.updateNode(node.id, setNodeFillOkHCL(node, 0, { h: 10, c: 0.1, l: 0.5 }))
    expect(getFillOkHCL(getNodeOrThrow(graph, node.id), 0)).not.toBeNull()

    graph.updateNode(node.id, clearNodeFillOkHCL(getNodeOrThrow(graph, node.id), 0))
    expect(getFillOkHCL(getNodeOrThrow(graph, node.id), 0)).toBeNull()
  })

  test('can disable stroke OkHCL metadata', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('FRAME', page.id, {
      strokes: [
        { color: { r: 0, g: 0, b: 1, a: 1 }, weight: 1, opacity: 1, visible: true, align: 'INSIDE' }
      ]
    })

    graph.updateNode(node.id, setNodeStrokeOkHCL(node, 0, { h: 200, c: 0.1, l: 0.5 }))
    expect(getStrokeOkHCL(getNodeOrThrow(graph, node.id), 0)).not.toBeNull()

    graph.updateNode(node.id, clearNodeStrokeOkHCL(getNodeOrThrow(graph, node.id), 0))
    expect(getStrokeOkHCL(getNodeOrThrow(graph, node.id), 0)).toBeNull()
  })
})
