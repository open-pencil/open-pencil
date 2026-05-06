import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('FILL flexBasis', () => {
  test('FILL children with different content sizes get equal width', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })

    const inner1 = autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 50,
      layoutGrow: 1
    })
    rect(graph, inner1.id, 100, 50)

    const inner2 = autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 200,
      height: 50,
      layoutGrow: 1
    })
    rect(graph, inner2.id, 200, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(200)
    expect(children[1].width).toBe(200)
  })

  test('nested FILL children distribute from zero basis', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100,
      itemSpacing: 0
    })
    autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FILL' as const,
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 100
    })
    autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FILL' as const,
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 100
    })
    autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FILL' as const,
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 100
    })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(100)
    expect(children[1].width).toBe(100)
    expect(children[2].width).toBe(100)
  })
})
