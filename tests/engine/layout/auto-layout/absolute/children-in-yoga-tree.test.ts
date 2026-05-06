import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('absolute children in Yoga tree', () => {
  test('absolute children do not affect auto-layout flow', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 100, 100, { layoutPositioning: 'ABSOLUTE', x: 300, y: 150 })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(100)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[2].x).toBe(50)

    expect(children[1].x).toBe(300)
    expect(children[1].y).toBe(150)
  })

  test('absolute children preserve position when parent resizes', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 80, 40, { layoutPositioning: 'ABSOLUTE', x: 200, y: 100 })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(200)
    expect(children[1].y).toBe(100)
    expect(children[1].width).toBe(80)
    expect(children[1].height).toBe(40)
  })
})
