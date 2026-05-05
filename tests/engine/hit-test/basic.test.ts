import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

function pageId(graph: SceneGraph) {
  return graph.getPages()[0].id
}

describe('hitTest — hidden nodes', () => {
  test('visible node at point is found', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect = graph.createNode('RECTANGLE', page, {
      name: 'R',
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })

    const hit = graph.hitTest(125, 125)
    expect(hit).not.toBeNull()
    expect(hit?.id).toBe(rect.id)
  })

  test('hidden node (visible: false) is skipped', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, {
      name: 'R',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      visible: false
    })

    const hit = graph.hitTest(125, 125)
    expect(hit).toBeNull()
  })

  test('hidden child inside visible frame is skipped', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    graph.createNode('RECTANGLE', frame.id, {
      name: 'R',
      x: 50,
      y: 50,
      width: 50,
      height: 50,
      visible: false
    })

    const hit = graph.hitTest(75, 75)
    // Frame itself has no visible fill/stroke, so it's not hit either
    expect(hit).toBeNull()
  })
})

describe('hitTest — locked nodes', () => {
  test('locked container returns itself, does not recurse deeper', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    // A locked GROUP (transparent container) with a child at the same point
    const group = graph.createNode('GROUP', page, {
      name: 'G',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      locked: true
    })
    graph.createNode('RECTANGLE', group.id, {
      name: 'R',
      x: 50,
      y: 50,
      width: 50,
      height: 50
    })

    // The point (75, 75) is inside the child rectangle inside the locked group.
    // Since the group is locked, hitTest should return the GROUP (not the child).
    const hit = graph.hitTest(75, 75)
    expect(hit).not.toBeNull()
    expect(hit?.id).toBe(group.id)
  })

  test('unlocked container recurses to child', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = graph.createNode('FRAME', page, {
      name: 'F',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    const rect = graph.createNode('RECTANGLE', frame.id, {
      name: 'R',
      x: 50,
      y: 50,
      width: 50,
      height: 50
    })

    const hit = graph.hitTest(75, 75)
    expect(hit).not.toBeNull()
    expect(hit?.id).toBe(rect.id)
  })
})

describe('hitTest — opacity', () => {
  test('zero-opacity node is still hit-testable', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect = graph.createNode('RECTANGLE', page, {
      name: 'R',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      opacity: 0
    })

    // Opacity is visual, not structural. Zero-opacity nodes should still be hit.
    const hit = graph.hitTest(125, 125)
    expect(hit).not.toBeNull()
    expect(hit?.id).toBe(rect.id)
  })
})

describe('hitTest — point outside all nodes', () => {
  test('returns null for empty area', () => {
    const graph = new SceneGraph()

    const hit = graph.hitTest(500, 500)
    expect(hit).toBeNull()
  })

  test('returns null for point outside node bounds', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    graph.createNode('RECTANGLE', page, {
      name: 'R',
      x: 100,
      y: 100,
      width: 50,
      height: 50
    })

    const hit = graph.hitTest(200, 200)
    expect(hit).toBeNull()
  })
})

describe('hitTest — deep mode', () => {
  test('hitTestDeep returns deep container for opaque containers', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page, {
      name: 'C',
      x: 0,
      y: 0,
      width: 200,
      height: 200
    })
    graph.createNode('RECTANGLE', component.id, {
      name: 'R',
      x: 50,
      y: 50,
      width: 50,
      height: 50
    })

    // Normal hitTest should return the component (opaque)
    const normalHit = graph.hitTest(75, 75)
    expect(normalHit?.id).toBe(component.id)

    // Deep hitTest should return the rectangle inside the component
    const deepHit = graph.hitTestDeep(75, 75)
    expect(deepHit).not.toBeNull()
    expect(deepHit?.type).toBe('RECTANGLE')
  })
})

describe('hitTest — z-order (last child wins)', () => {
  test('overlapping children: last in childIds array is hit', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const rect1 = graph.createNode('RECTANGLE', page, {
      name: 'R1',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })
    const rect2 = graph.createNode('RECTANGLE', page, {
      name: 'R2',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    })

    // Both overlap at (50, 50). Last child (rect2) should be hit.
    const hit = graph.hitTest(50, 50)
    expect(hit?.id).toBe(rect2.id)
    expect(hit?.id).not.toBe(rect1.id)
  })
})
