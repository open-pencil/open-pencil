import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/core'

import { expectDefined, getNodeOrThrow } from '../../../helpers/assert'
import { createRect, firstPageId } from '../../../helpers/scene'

describe('multi-node property merging', () => {
  test('same values merge to single value', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const a = createRect(graph, page, { width: 100, height: 50 })
    const b = createRect(graph, page, { width: 100, height: 50 })
    const nodes = [getNodeOrThrow(graph, a.id), getNodeOrThrow(graph, b.id)]

    const widths = new Set(nodes.map((n) => n.width))
    expect(widths.size).toBe(1)
    expect([...widths][0]).toBe(100)
  })

  test('different values are detected', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const a = createRect(graph, page, { width: 100 })
    const b = createRect(graph, page, { width: 200 })
    const nodes = [getNodeOrThrow(graph, a.id), getNodeOrThrow(graph, b.id)]

    const widths = new Set(nodes.map((n) => n.width))
    expect(widths.size).toBe(2)
  })

  test('update applies to all selected nodes', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const a = createRect(graph, page, { width: 100 })
    const b = createRect(graph, page, { width: 200 })
    const c = createRect(graph, page, { width: 150 })

    for (const id of [a.id, b.id, c.id]) {
      graph.updateNode(id, { width: 300 })
    }

    expect(getNodeOrThrow(graph, a.id).width).toBe(300)
    expect(getNodeOrThrow(graph, b.id).width).toBe(300)
    expect(getNodeOrThrow(graph, c.id).width).toBe(300)
  })

  test('opacity update applies uniformly', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const a = createRect(graph, page)
    const b = createRect(graph, page)

    graph.updateNode(a.id, { opacity: 0.5 })
    graph.updateNode(b.id, { opacity: 0.8 })

    for (const id of [a.id, b.id]) {
      graph.updateNode(id, { opacity: 0.75 })
    }

    expect(getNodeOrThrow(graph, a.id).opacity).toBe(0.75)
    expect(getNodeOrThrow(graph, b.id).opacity).toBe(0.75)
  })

  test('fills comparison detects mixed', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const a = createRect(graph, page)
    const b = createRect(graph, page)

    graph.updateNode(a.id, {
      fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
    })
    graph.updateNode(b.id, {
      fills: [{ type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }]
    })

    const nodeA = getNodeOrThrow(graph, a.id)
    const nodeB = getNodeOrThrow(graph, b.id)
    expect(JSON.stringify(nodeA.fills)).not.toBe(JSON.stringify(nodeB.fills))
  })

  test('fills comparison detects same', () => {
    const graph = new SceneGraph()
    const page = firstPageId(graph)
    const fill = {
      type: 'SOLID' as const,
      color: { r: 1, g: 0, b: 0, a: 1 },
      opacity: 1,
      visible: true
    }
    const a = createRect(graph, page)
    const b = createRect(graph, page)

    graph.updateNode(a.id, { fills: [{ ...fill }] })
    graph.updateNode(b.id, { fills: [{ ...fill }] })

    const nodeA = getNodeOrThrow(graph, a.id)
    const nodeB = getNodeOrThrow(graph, b.id)
    expect(JSON.stringify(nodeA.fills)).toBe(JSON.stringify(nodeB.fills))
  })
})
