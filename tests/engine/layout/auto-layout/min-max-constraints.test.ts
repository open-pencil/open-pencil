import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('min/max constraints', () => {
  test('maxWidth clamps child in horizontal layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxWidth: 200 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.width).toBe(200)
  })

  test('minWidth prevents shrinking below minimum', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 100,
      height: 100
    })
    rect(graph, frame.id, 200, 50, { minWidth: 150 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.width).toBeGreaterThanOrEqual(150)
  })

  test('maxHeight clamps child in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1, maxHeight: 150 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.height).toBe(150)
  })

  test('minHeight enforces minimum in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 30, { minHeight: 80 })

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.height).toBe(80)
  })

  test('min/max on nested auto-layout frame', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 500,
      height: 200
    })
    const inner = autoFrame(graph, outer.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 50,
      layoutGrow: 1,
      maxWidth: 250
    })
    rect(graph, inner.id, 30, 30)

    computeLayout(graph, outer.id)

    const innerNode = getNodeOrThrow(graph, inner.id)
    expect(innerNode.width).toBe(250)
  })
})
