import { describe, expect, test } from 'bun:test'

import { SceneGraph, type NodeType, type SceneNode } from '@open-pencil/scene-graph'

import { pageId, rect } from './helpers'

// Each expectation matches a drag observed in Figma desktop 126 with real pointer input.

function container(
  graph: SceneGraph,
  type: NodeType,
  parentId: string,
  props: Partial<SceneNode> = {}
) {
  return graph.createNode(type, parentId, { x: 0, y: 0, width: 200, height: 200, ...props })
}

function dropAt(graph: SceneGraph, x: number, y: number, exclude: string[] = []) {
  return graph.hitTestDropTarget(x, y, new Set(exclude), pageId(graph))?.id ?? null
}

describe('hitTestDropTarget', () => {
  test('takes the frame under the cursor however little of the layer is inside', () => {
    const graph = new SceneGraph()
    const frame = container(graph, 'FRAME', pageId(graph))
    expect(dropAt(graph, 190, 100)).toBe(frame.id)
    expect(dropAt(graph, 205, 150)).toBeNull()
  })

  test('takes the topmost of overlapping frames', () => {
    const graph = new SceneGraph()
    container(graph, 'FRAME', pageId(graph))
    const top = container(graph, 'FRAME', pageId(graph), { x: 100, y: 100 })
    expect(dropAt(graph, 150, 150)).toBe(top.id)
  })

  test('takes the deepest frame', () => {
    const graph = new SceneGraph()
    const outer = container(graph, 'FRAME', pageId(graph), { width: 400, height: 400 })
    const inner = container(graph, 'FRAME', outer.id, { x: 50, y: 50, width: 100, height: 100 })
    expect(dropAt(graph, 100, 100)).toBe(inner.id)
    expect(dropAt(graph, 300, 300)).toBe(outer.id)
  })

  test('never takes groups, boolean operations, or component sets', () => {
    const graph = new SceneGraph()
    container(graph, 'GROUP', pageId(graph))
    container(graph, 'BOOLEAN_OPERATION', pageId(graph))
    container(graph, 'COMPONENT_SET', pageId(graph))
    expect(dropAt(graph, 100, 100)).toBeNull()
  })

  test('looks through groups and component sets to the frames inside', () => {
    const graph = new SceneGraph()
    const group = container(graph, 'GROUP', pageId(graph))
    const framed = container(graph, 'FRAME', group.id, { width: 100, height: 100 })
    const set = container(graph, 'COMPONENT_SET', pageId(graph), { x: 300 })
    const variant = container(graph, 'COMPONENT', set.id, { width: 100, height: 100 })
    expect(dropAt(graph, 50, 50)).toBe(framed.id)
    expect(dropAt(graph, 350, 50)).toBe(variant.id)
  })

  test('takes components', () => {
    const graph = new SceneGraph()
    const component = container(graph, 'COMPONENT', pageId(graph))
    expect(dropAt(graph, 100, 100)).toBe(component.id)
  })

  test('skips locked frames and their contents', () => {
    const graph = new SceneGraph()
    const locked = container(graph, 'FRAME', pageId(graph), { locked: true })
    container(graph, 'FRAME', locked.id, { width: 100, height: 100 })
    expect(dropAt(graph, 50, 50)).toBeNull()
  })

  test('skips hidden frames and excluded layers', () => {
    const graph = new SceneGraph()
    container(graph, 'FRAME', pageId(graph), { visible: false })
    const dragged = container(graph, 'FRAME', pageId(graph), { x: 300 })
    expect(dropAt(graph, 100, 100)).toBeNull()
    expect(dropAt(graph, 350, 100, [dragged.id])).toBeNull()
  })

  test('uses the rotated shape, not its bounding box', () => {
    const graph = new SceneGraph()
    // Rotated 45° about its center; the box corner (5, 5) lies outside the diamond.
    const frame = container(graph, 'FRAME', pageId(graph), { rotation: 45 })
    expect(dropAt(graph, 100, 100)).toBe(frame.id)
    expect(dropAt(graph, 5, 5)).toBeNull()
  })

  test('ignores the clipped-away part of a child frame', () => {
    const graph = new SceneGraph()
    const clipping = container(graph, 'FRAME', pageId(graph), { clipsContent: true })
    container(graph, 'FRAME', clipping.id, { x: 150, y: 50, width: 200, height: 100 })
    expect(dropAt(graph, 300, 100)).toBeNull()
  })

  test('takes the overflowing part of a child frame when its parent does not clip', () => {
    const graph = new SceneGraph()
    const parent = container(graph, 'FRAME', pageId(graph), { clipsContent: false })
    const child = container(graph, 'FRAME', parent.id, { x: 150, y: 50, width: 200, height: 100 })
    expect(dropAt(graph, 300, 100)).toBe(child.id)
  })

  test('takes only a dragged variant back into its own component set', () => {
    const graph = new SceneGraph()
    const set = container(graph, 'COMPONENT_SET', pageId(graph), { width: 300 })
    const variant = container(graph, 'COMPONENT', set.id, { width: 60, height: 60 })
    const sibling = container(graph, 'COMPONENT', set.id, { x: 100, width: 100, height: 100 })
    const own = { componentSetIds: new Set([set.id]) }
    const foreign = { componentSetIds: new Set([pageId(graph)]) }
    const drop = (x: number, y: number, options: typeof own) =>
      graph.hitTestDropTarget(x, y, new Set([variant.id]), pageId(graph), options)?.id ?? null
    expect(drop(150, 50, own)).toBe(set.id)
    expect(drop(250, 150, own)).toBe(set.id)
    expect(drop(150, 50, foreign)).toBeNull()
    expect(dropAt(graph, 150, 50, [variant.id])).toBe(sibling.id)
  })

  test('isPointInNode follows rotation', () => {
    const graph = new SceneGraph()
    const frame = container(graph, 'FRAME', pageId(graph), { rotation: 45 })
    expect(graph.isPointInNode(frame.id, 100, 100)).toBe(true)
    expect(graph.isPointInNode(frame.id, 5, 5)).toBe(false)
  })

  test('ignores shapes covering a frame', () => {
    const graph = new SceneGraph()
    const frame = container(graph, 'FRAME', pageId(graph))
    rect(graph, 'Cover', 0, 0, 200, 200)
    expect(dropAt(graph, 100, 100)).toBe(frame.id)
  })
})
