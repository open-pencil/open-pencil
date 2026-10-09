import { describe, expect, test } from 'bun:test'

import {
  autoLayoutSizingFields,
  fillSizingFields,
  layoutSizing,
  layoutSizingUpdates,
  SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

function child(parent: Partial<SceneNode>, node: Partial<SceneNode> = {}) {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 300,
    height: 200,
    ...parent
  })
  return { graph, node: graph.createNode('FRAME', frame.id, { width: 40, height: 30, ...node }) }
}

describe('layout sizing across a stretching parent', () => {
  test('fixing the cross axis opts out of stretch the parent applies to every child', () => {
    const { graph, node } = child({ layoutMode: 'HORIZONTAL', counterAxisAlign: 'STRETCH' })
    expect(layoutSizing(graph, node, 'VERTICAL')).toBe('FILL')

    const updates = layoutSizingUpdates(graph, node, 'VERTICAL', 'FIXED')
    expect(updates).toEqual({ layoutAlignSelf: 'MIN' })
    graph.updateNode(node.id, updates)
    expect(layoutSizing(graph, node, 'VERTICAL')).toBe('FIXED')
  })

  test('fixing an explicit stretch clears it', () => {
    const { graph, node } = child({ layoutMode: 'HORIZONTAL' }, { layoutAlignSelf: 'STRETCH' })
    expect(layoutSizingUpdates(graph, node, 'VERTICAL', 'FIXED')).toEqual({
      layoutAlignSelf: 'AUTO'
    })
  })
})

describe('sizing fields for nodes built before they join the graph', () => {
  test('fill fields read back as fill on each axis of every auto layout parent', () => {
    for (const layoutMode of ['HORIZONTAL', 'VERTICAL', 'GRID'] as const) {
      for (const axis of ['HORIZONTAL', 'VERTICAL'] as const) {
        const { graph, node } = child({ layoutMode }, fillSizingFields(layoutMode, axis))
        expect(layoutSizing(graph, node, axis)).toBe('FILL')
        const other = axis === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL'
        expect(layoutSizing(graph, node, other)).not.toBe('FILL')
      }
    }
  })

  test('fill under a parent without auto layout fills either axis once placed', () => {
    const fields = fillSizingFields('NONE', 'HORIZONTAL')
    for (const layoutMode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const { graph, node } = child({ layoutMode }, fields)
      expect(layoutSizing(graph, node, 'HORIZONTAL')).toBe('FILL')
    }
  })

  test('own sizing fields read back per screen axis', () => {
    for (const layoutMode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const { graph, node } = child(
        {},
        { layoutMode, ...autoLayoutSizingFields(layoutMode, 'HUG', 'FIXED') }
      )
      expect(layoutSizing(graph, node, 'HORIZONTAL')).toBe('HUG')
      expect(layoutSizing(graph, node, 'VERTICAL')).toBe('FIXED')
    }
  })
})
