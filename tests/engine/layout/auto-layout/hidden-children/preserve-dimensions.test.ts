import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('hidden children preserve dimensions', () => {
  test('re-showing a hidden child restores original size', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100
    })
    const child = rect(graph, frame.id, 80, 60)

    computeLayout(graph, frame.id)
    expect(getNodeOrThrow(graph, child.id).width).toBe(80)

    graph.updateNode(child.id, { visible: false })
    computeLayout(graph, frame.id)
    expect(getNodeOrThrow(graph, child.id).width).toBe(80)
    expect(getNodeOrThrow(graph, child.id).height).toBe(60)

    graph.updateNode(child.id, { visible: true })
    computeLayout(graph, frame.id)
    expect(getNodeOrThrow(graph, child.id).width).toBe(80)
    expect(getNodeOrThrow(graph, child.id).height).toBe(60)
  })
})
