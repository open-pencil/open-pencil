import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('counter axis spacing (no wrap)', () => {
  test('counterAxisSpacing is ignored without wrap in horizontal', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100,
      counterAxisSpacing: 50,
      layoutWrap: 'NO_WRAP'
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // Without wrap, counterAxisSpacing has no effect
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(50)
  })
})
