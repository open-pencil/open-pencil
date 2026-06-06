import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import type { VectorNetwork } from '@open-pencil/core/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'

const originalVectorNetwork: VectorNetwork = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 }
  ],
  segments: [
    { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 1, end: 2, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 2, end: 3, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } },
    { start: 3, end: 0, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
  ],
  regions: []
}

const scaledVectorNetwork: VectorNetwork = {
  ...originalVectorNetwork,
  vertices: originalVectorNetwork.vertices.map((vertex) => ({
    x: vertex.x * 2,
    y: vertex.y * 2
  }))
}

describe('group resize undo', () => {
  test('restores descendant vector geometry', () => {
    const editor = createEditor()
    const page = editor.graph.getPages()[0]
    const group = editor.graph.createNode('GROUP', page.id, {
      x: 0,
      y: 0,
      width: 10,
      height: 10
    })
    const vector = editor.graph.createNode('VECTOR', group.id, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      vectorNetwork: originalVectorNetwork
    })

    editor.graph.updateNode(group.id, { width: 20, height: 20 })
    editor.graph.updateNode(vector.id, {
      width: 20,
      height: 20,
      vectorNetwork: scaledVectorNetwork
    })
    editor.commitGroupResize(
      group.id,
      { x: 0, y: 0, width: 10, height: 10 },
      new Map([
        [
          vector.id,
          {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
            vectorNetwork: originalVectorNetwork
          }
        ]
      ])
    )

    editor.undo.undo()
    const restored = getNodeOrThrow(editor.graph, vector.id)
    expect(restored.width).toBe(10)
    expect(restored.height).toBe(10)
    expect(restored.vectorNetwork?.vertices).toEqual(originalVectorNetwork.vertices)

    editor.undo.redo()
    const redone = getNodeOrThrow(editor.graph, vector.id)
    expect(redone.width).toBe(20)
    expect(redone.height).toBe(20)
    expect(redone.vectorNetwork?.vertices).toEqual(scaledVectorNetwork.vertices)
  })
})
