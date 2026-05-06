import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { pageId, rect } from '#tests/helpers/layout'

describe('layout mode NONE', () => {
  test('computeLayout does nothing for NONE layout', () => {
    const graph = new SceneGraph()
    const frame = graph.createNode('FRAME', pageId(graph), {
      name: 'Plain',
      layoutMode: 'NONE',
      width: 400,
      height: 200
    })
    const child = rect(graph, frame.id, 50, 50, { x: 100, y: 100 })

    computeLayout(graph, frame.id)

    const c = getNodeOrThrow(graph, child.id)
    expect(c.x).toBe(100)
    expect(c.y).toBe(100)
  })
})
