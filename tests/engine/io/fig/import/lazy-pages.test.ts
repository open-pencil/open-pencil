import { describe, expect, test } from 'bun:test'

import {
  populateAllLazyFigImportRoots,
  populateLazyFigImportRoots,
  setLazyFigImportContext
} from '@inkly/core/kiwi/fig/lazy-import'
import { SceneGraph } from '@inkly/core/scene-graph'

function createLazyGraph() {
  const graph = new SceneGraph()
  const [page1] = graph.getPages()
  const page2 = graph.addPage('Page 2')
  const component = graph.createNode('COMPONENT', page1.id, {
    name: 'Button',
    width: 100,
    height: 40
  })
  graph.createNode('RECTANGLE', component.id, {
    name: 'Background',
    width: 100,
    height: 40
  })
  const page1Instance = graph.createNode('INSTANCE', page1.id, {
    name: 'Button instance 1',
    componentId: component.id,
    width: 100,
    height: 40
  })
  const page2Instance = graph.createNode('INSTANCE', page2.id, {
    name: 'Button instance 2',
    componentId: component.id,
    width: 100,
    height: 40
  })

  setLazyFigImportContext(graph, {
    changeMap: new Map(),
    guidToNodeId: new Map(),
    blobs: [],
    populatedRootIds: new Set([page1.id])
  })

  return { graph, page1, page2, page1Instance, page2Instance }
}

describe('lazy .fig page population', () => {
  test('populates an unvisited page once', () => {
    const { graph, page2, page1Instance, page2Instance } = createLazyGraph()

    expect(graph.getChildren(page1Instance.id)).toHaveLength(0)
    expect(graph.getChildren(page2Instance.id)).toHaveLength(0)

    expect(populateLazyFigImportRoots(graph, [page2.id])).toBe(true)
    expect(graph.getChildren(page1Instance.id)).toHaveLength(0)
    expect(graph.getChildren(page2Instance.id)).toHaveLength(1)

    const nodeCount = graph.nodes.size
    expect(populateLazyFigImportRoots(graph, [page2.id])).toBe(false)
    expect(graph.nodes.size).toBe(nodeCount)
  })

  test('can populate all remaining pages before full-document operations', () => {
    const { graph, page1Instance, page2Instance } = createLazyGraph()

    expect(populateAllLazyFigImportRoots(graph)).toBe(true)
    expect(graph.getChildren(page1Instance.id)).toHaveLength(0)
    expect(graph.getChildren(page2Instance.id)).toHaveLength(1)
    expect(populateAllLazyFigImportRoots(graph)).toBe(false)
  })
})
