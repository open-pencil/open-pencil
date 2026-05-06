import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('nested auto layout', () => {
  test('nested horizontal frames', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 500,
      height: 200,
      itemSpacing: 10
    })
    const inner = autoFrame(graph, outer.id, {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 999,
      height: 100,
      itemSpacing: 5
    })
    rect(graph, inner.id, 40, 40)
    rect(graph, inner.id, 60, 40)
    rect(graph, outer.id, 80, 80)

    computeLayout(graph, outer.id)

    const innerNode = getNodeOrThrow(graph, inner.id)
    expect(innerNode.width).toBe(105)
    expect(innerNode.x).toBe(0)

    const outerChildren = graph.getChildren(outer.id)
    expect(outerChildren[1].x).toBe(115)
  })

  test('nested vertical inside horizontal', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 500,
      height: 300,
      itemSpacing: 20
    })
    const inner = autoFrame(graph, outer.id, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 999,
      itemSpacing: 10
    })
    rect(graph, inner.id, 80, 50)
    rect(graph, inner.id, 80, 70)
    rect(graph, outer.id, 60, 60)

    computeLayout(graph, outer.id)

    const innerNode = getNodeOrThrow(graph, inner.id)
    expect(innerNode.height).toBe(130)

    const outerChildren = graph.getChildren(outer.id)
    expect(outerChildren[0].x).toBe(0)
    expect(outerChildren[1].x).toBe(120)
  })

  test('computeAllLayouts handles deeply nested frames', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const outer = autoFrame(graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 500,
      itemSpacing: 10
    })
    const middle = autoFrame(graph, outer.id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 999,
      height: 999,
      itemSpacing: 5
    })
    rect(graph, middle.id, 40, 30)
    rect(graph, middle.id, 60, 30)
    rect(graph, outer.id, 100, 50)

    computeAllLayouts(graph)

    const middleNode = getNodeOrThrow(graph, middle.id)
    expect(middleNode.width).toBe(105)
    expect(middleNode.height).toBe(30)

    const outerChildren = graph.getChildren(outer.id)
    expect(outerChildren[0].y).toBe(0)
    expect(outerChildren[1].y).toBe(40)
  })
})
