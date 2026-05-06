import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('wrap layout', () => {
  test('wraps children in horizontal layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP'
    })
    rect(graph, frame.id, 80, 40)
    rect(graph, frame.id, 80, 40)
    rect(graph, frame.id, 80, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // First two fit on first row (80 + 80 = 160 <= 200)
    expect(children[0].x).toBe(0)
    expect(children[0].y).toBe(0)
    expect(children[1].x).toBe(80)
    expect(children[1].y).toBe(0)
    // Third wraps to second row
    expect(children[2].x).toBe(0)
    expect(children[2].y).toBe(40)
  })

  test('counterAxisSpacing adds gap between wrapped rows', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP',
      counterAxisSpacing: 10
    })
    rect(graph, frame.id, 120, 40)
    rect(graph, frame.id, 120, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(50)
  })

  test('itemSpacing with wrap', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 300,
      layoutWrap: 'WRAP',
      itemSpacing: 10
    })
    // 90 + 10 + 90 = 190, fits in 200
    rect(graph, frame.id, 90, 40)
    rect(graph, frame.id, 90, 40)
    // 90 wraps to next row
    rect(graph, frame.id, 90, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(100)
    expect(children[2].x).toBe(0)
    expect(children[2].y).toBe(40)
  })
})
