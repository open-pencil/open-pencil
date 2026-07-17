import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

function firstPageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('SceneGraph source dirty tracking', () => {
  test('records normalized edited fields once in update order', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', firstPageId(graph))

    graph.updateNode(node.id, { width: 200, fills: [] })
    graph.updateNode(node.id, { width: 240, opacity: 0.5 })

    expect(node.source.editedFields).toEqual(['width', 'fills', 'opacity'])
  })

  test('preservation scope suppresses import-time dirty tracking', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', firstPageId(graph))

    graph.preserveSourceMetadataDuring(() => graph.updateNode(node.id, { width: 200 }))

    expect(node.source.editedFields).toEqual([])
  })

  test('cloned source dirty fields are independent', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('RECTANGLE', firstPageId(graph))
    graph.updateNode(node.id, { width: 200 })
    const clone = graph.cloneTree(node.id, firstPageId(graph))
    expect(clone).not.toBeNull()
    if (!clone) return

    graph.updateNode(clone.id, { height: 300 })

    expect(node.source.editedFields).toEqual(['width'])
    expect(clone.source.editedFields).toEqual(['width', 'height'])
  })
})
