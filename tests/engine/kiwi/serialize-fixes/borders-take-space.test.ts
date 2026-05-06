import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { pageId, toKiwi } from './helpers'

describe('Fix 3: bordersTakeSpace serialization', () => {
  test('auto-layout frame with strokesIncludedInLayout=true gets bordersTakeSpace=true', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'LayoutWithBorders',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      strokesIncludedInLayout: true
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].bordersTakeSpace).toBe(true)
  })

  test('auto-layout frame with strokesIncludedInLayout=false gets bordersTakeSpace=false', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'LayoutNoBorders',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      strokesIncludedInLayout: false
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].bordersTakeSpace).toBe(false)
  })

  test('non-auto-layout frame does not get bordersTakeSpace', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', pageId(graph), {
      name: 'PlainFrame',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      strokesIncludedInLayout: true
    })

    const changes = toKiwi(node, graph) as Record<string, unknown>[]
    expect(changes[0].bordersTakeSpace).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Fix 4 — lineHeight always written on text nodes
// ---------------------------------------------------------------------------
