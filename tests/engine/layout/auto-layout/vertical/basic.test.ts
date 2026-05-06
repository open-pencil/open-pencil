import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('vertical basic', () => {
  test('positions children top-to-bottom', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 80)
    rect(graph, frame.id, 50, 60)
    rect(graph, frame.id, 50, 100)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(80)
    expect(children[2].y).toBe(140)
  })

  test('applies item spacing vertically', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      itemSpacing: 16
    })
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 50, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(56)
    expect(children[2].y).toBe(112)
  })
})
