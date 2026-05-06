import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { pageId, rect } from './helpers'

describe('countDescendants', () => {
  test('nonexistent node returns 0', () => {
    const graph = new SceneGraph()
    expect(graph.countDescendants('nonexistent-id')).toBe(0)
  })

  test('page with 0 children returns 0', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    // Default new graph has an empty page
    expect(graph.countDescendants(page.id)).toBe(0)
  })

  test('counts all descendants recursively', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    // Create a 3-level hierarchy: page → frame → rect, ellipse
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    graph.createNode('RECTANGLE', frame, { name: 'R1', x: 0, y: 0, width: 10, height: 10 })
    graph.createNode('ELLIPSE', frame, { name: 'E1', x: 20, y: 20, width: 10, height: 10 })
    // Page descendants = frame + R1 + E1 = 3
    expect(graph.countDescendants(page)).toBe(3)
    // Frame has 2 descendants
    expect(graph.countDescendants(frame)).toBe(2)
    // Leaf has 0
    const rectId = graph.getChildren(frame)[0].id
    expect(graph.countDescendants(rectId)).toBe(0)
  })

  test('root node count includes all pages and their children', () => {
    const graph = new SceneGraph()
    rect(graph, 'R1')
    rect(graph, 'R2')
    graph.addPage('Page 2')
    const page2 = graph.getPages()[1].id
    graph.createNode('RECTANGLE', page2, { name: 'R3', x: 0, y: 0, width: 10, height: 10 })
    // Root descendants = Page1 + R1 + R2 + Page2 + R3 = 5
    expect(graph.countDescendants(graph.rootId)).toBe(5)
  })

  test('does not crash on a node with 200k direct children (spread regression)', () => {
    // V8/JSC spread-into-push caps function arguments at ~125k–500k depending on engine
    // and version. Using stack.push(...childIds) inside a loop crashes with
    // RangeError: Maximum call stack size exceeded on real Figma documents.
    // This test guards against the regression introduced in a6122c13.
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'BigFrame',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    }).id
    const CHILD_COUNT = 200_000
    // Directly inject children into the node map to avoid O(N^2) createNode overhead
    const frameNode = graph.nodes.get(frame)
    if (!frameNode) throw new Error('frame not found')
    for (let i = 0; i < CHILD_COUNT; i++) {
      const childId = `bulk:${i}`
      graph.nodes.set(childId, {
        ...frameNode,
        id: childId,
        name: `bulk_${i}`,
        type: 'RECTANGLE',
        childIds: [],
        parentId: frame
      })
      frameNode.childIds.push(childId)
    }
    expect(() => graph.countDescendants(frame)).not.toThrow()
    expect(graph.countDescendants(frame)).toBe(CHILD_COUNT)
  })
})
