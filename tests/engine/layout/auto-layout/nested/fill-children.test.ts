import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('nested auto layout with fill children', () => {
  test('child frame with FILL sizing expands in parent', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      itemSpacing: 10
    })
    rect(graph, outer.id, 100, 50)
    const inner = autoFrame(graph, outer.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 50,
      layoutGrow: 1
    })
    rect(graph, inner.id, 30, 30)

    computeLayout(graph, outer.id)

    const innerNode = getNodeOrThrow(graph, inner.id)
    // 400 - 100 - 10 = 290
    expect(innerNode.width).toBe(290)
  })
})
