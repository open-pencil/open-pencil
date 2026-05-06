import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('absolute positioning', () => {
  test('absolute children are skipped in layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50, {
      layoutPositioning: 'ABSOLUTE',
      x: 200,
      y: 100
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    // First auto child at 0
    expect(children[0].x).toBe(0)
    // Absolute child should keep its position
    expect(children[1].x).toBe(200)
    expect(children[1].y).toBe(100)
    // Third child should be right after first (no gap for absolute)
    expect(children[2].x).toBe(60)
  })
})
