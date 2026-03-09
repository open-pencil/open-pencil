import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('absolute position cache', () => {
  test('cached result matches uncached computation', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { name: 'F', x: 100, y: 200 })
    const child = graph.createNode('RECTANGLE', frame.id, { name: 'R', x: 10, y: 20 })

    const first = graph.getAbsolutePosition(child.id)
    const second = graph.getAbsolutePosition(child.id)

    expect(first).toEqual({ x: 110, y: 220 })
    expect(second).toEqual({ x: 110, y: 220 })
    expect(first).toBe(second)
  })

  test('cache invalidated after node position change', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), { name: 'F', x: 50, y: 50 })
    const child = graph.createNode('RECTANGLE', frame.id, { name: 'R', x: 10, y: 10 })

    expect(graph.getAbsolutePosition(child.id)).toEqual({ x: 60, y: 60 })

    graph.updateNode(frame.id, { x: 100, y: 100 })

    expect(graph.getAbsolutePosition(child.id)).toEqual({ x: 110, y: 110 })
  })

  test('cache invalidated after reparenting', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frameA = graph.createNode('FRAME', page, { name: 'A', x: 100, y: 100 })
    const frameB = graph.createNode('FRAME', page, { name: 'B', x: 300, y: 300 })
    const child = graph.createNode('RECTANGLE', frameA.id, { name: 'R', x: 10, y: 10 })

    expect(graph.getAbsolutePosition(child.id)).toEqual({ x: 110, y: 110 })

    graph.reparentNode(child.id, frameB.id)

    const pos = graph.getAbsolutePosition(child.id)
    expect(pos).toEqual({ x: 110, y: 110 })
  })

  test('nested nodes (3+ levels) get correct absolute positions', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const level1 = graph.createNode('FRAME', page, { name: 'L1', x: 10, y: 20 })
    const level2 = graph.createNode('FRAME', level1.id, { name: 'L2', x: 30, y: 40 })
    const level3 = graph.createNode('FRAME', level2.id, { name: 'L3', x: 50, y: 60 })
    const leaf = graph.createNode('RECTANGLE', level3.id, { name: 'Leaf', x: 1, y: 2 })

    expect(graph.getAbsolutePosition(level1.id)).toEqual({ x: 10, y: 20 })
    expect(graph.getAbsolutePosition(level2.id)).toEqual({ x: 40, y: 60 })
    expect(graph.getAbsolutePosition(level3.id)).toEqual({ x: 90, y: 120 })
    expect(graph.getAbsolutePosition(leaf.id)).toEqual({ x: 91, y: 122 })
  })

  test('clearAbsPosCache forces recomputation', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'R', x: 10, y: 20 })

    const first = graph.getAbsolutePosition(rect.id)
    graph.clearAbsPosCache()
    const second = graph.getAbsolutePosition(rect.id)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })

  test('sibling cache entries survive unrelated sibling update', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const a = graph.createNode('RECTANGLE', page, { name: 'A', x: 10, y: 10 })
    const b = graph.createNode('RECTANGLE', page, { name: 'B', x: 20, y: 20 })

    graph.getAbsolutePosition(a.id)
    graph.updateNode(b.id, { x: 30 })

    const posA = graph.getAbsolutePosition(a.id)
    expect(posA).toEqual({ x: 10, y: 10 })
  })
})
