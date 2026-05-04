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

  test('non-layout changes do NOT clear absPosCache', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'R', x: 10, y: 20 })

    // Populate cache
    const cached = graph.getAbsolutePosition(rect.id)
    expect(cached).toEqual({ x: 10, y: 20 })

    // Update a non-layout property (fills)
    graph.updateNode(rect.id, {
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true,
          blendMode: 'NORMAL'
        }
      ]
    })

    // Cache should be preserved (same reference)
    const afterFill = graph.getAbsolutePosition(rect.id)
    expect(afterFill).toBe(cached) // strict reference equality

    // Update plugin data (non-layout)
    graph.updateNode(rect.id, {
      pluginData: [{ pluginId: 'test', key: 'k', value: 'v' }]
    })

    const afterPlugin = graph.getAbsolutePosition(rect.id)
    expect(afterPlugin).toBe(cached) // still same reference
  })

  test('layout changes DO clear absPosCache', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'R', x: 10, y: 20 })

    const cached = graph.getAbsolutePosition(rect.id)

    // Update a layout property (x)
    graph.updateNode(rect.id, { x: 50 })

    // Cache should be cleared (new computation)
    const afterX = graph.getAbsolutePosition(rect.id)
    expect(afterX).toEqual({ x: 50, y: 20 })
    expect(afterX).not.toBe(cached)

    // Rotation also clears cache
    const cached2 = graph.getAbsolutePosition(rect.id)
    graph.updateNode(rect.id, { rotation: 45 })
    const afterRotation = graph.getAbsolutePosition(rect.id)
    expect(afterRotation).not.toBe(cached2)
  })

  test('auto-layout property changes clear absPosCache', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    const child = graph.createNode('RECTANGLE', frame.id, { name: 'R', x: 10, y: 10 })

    const cached = graph.getAbsolutePosition(child.id)

    // Changing auto-layout property on parent clears cache
    graph.updateNode(frame.id, { primaryAxisAlign: 'CENTER' })
    const afterAlign = graph.getAbsolutePosition(child.id)
    expect(afterAlign).not.toBe(cached)

    // Changing itemSpacing also clears cache
    const cached2 = graph.getAbsolutePosition(child.id)
    graph.updateNode(frame.id, { itemSpacing: 10 })
    const afterSpacing = graph.getAbsolutePosition(child.id)
    expect(afterSpacing).not.toBe(cached2)
  })

  test('effects, fills, strokes, opacity changes do NOT clear absPosCache', () => {
    const graph = new SceneGraph()
    const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'R', x: 10, y: 20 })
    const cached = graph.getAbsolutePosition(rect.id)

    graph.updateNode(rect.id, {
      opacity: 0.5,
      fills: [],
      strokes: [],
      effects: []
    })
    expect(graph.getAbsolutePosition(rect.id)).toBe(cached)

    graph.updateNode(rect.id, { name: 'Renamed' })
    expect(graph.getAbsolutePosition(rect.id)).toBe(cached)

    graph.updateNode(rect.id, { visible: false })
    expect(graph.getAbsolutePosition(rect.id)).toBe(cached)
  })
})
