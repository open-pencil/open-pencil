import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('mixed sizing', () => {
  test('fixed primary, hug counter (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 999,
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG'
    })
    rect(graph, frame.id, 50, 80)
    rect(graph, frame.id, 50, 120)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(400)
    expect(f.height).toBe(120)
  })

  test('hug primary, fixed counter (vertical)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 999,
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 80, 60)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.height).toBe(110)
    expect(f.width).toBe(200)
  })
})
