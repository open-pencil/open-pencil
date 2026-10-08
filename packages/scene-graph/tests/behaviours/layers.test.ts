import { describe, expect, test } from 'bun:test'

import { findLayerByPath, layerPath, SceneGraph } from '@open-pencil/scene-graph'

describe('layer paths', () => {
  test('round-trip names that contain the path separators', () => {
    const graph = new SceneGraph()
    const root = graph.createNode('FRAME', graph.getPages()[0].id, { name: 'Card' })
    const group = graph.createNode('FRAME', root.id, { name: 'Row/1' })
    for (const name of ['Wifi#1', '50%', 'Label', 'Label']) {
      const node = graph.createNode('FRAME', group.id, { name })
      const path = layerPath(graph, root.id, node.id)
      expect(findLayerByPath(graph, root.id, path)?.id).toBe(node.id)
    }
    expect(layerPath(graph, root.id, group.id)).toBe('Row%2F1')
  })

  test('stops on a parent cycle in bad data', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const root = graph.createNode('FRAME', pageId, { name: 'Card' })
    const a = graph.createNode('FRAME', pageId, { name: 'A' })
    const b = graph.createNode('FRAME', a.id, { name: 'B' })
    // Imported data can point parents at each other; the walk must still end.
    const loose = graph.getNode(a.id)
    if (loose) loose.parentId = b.id
    expect(typeof layerPath(graph, root.id, b.id)).toBe('string')
  })
})
