import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('hidden children', () => {
  test('hidden children preserve original size but collapse in layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 50, { visible: false })
    rect(graph, frame.id, 80, 40)
    rect(graph, frame.id, 50, 50, { visible: false })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(50)
    expect(children[0].height).toBe(50)
    expect(children[1].x).toBe(0)
    expect(children[1].width).toBe(80)
    expect(children[2].width).toBe(50)
    expect(children[2].height).toBe(50)
  })

  test('hidden children do not consume spacing', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100,
      itemSpacing: 20
    })
    rect(graph, frame.id, 50, 50, { visible: false })
    rect(graph, frame.id, 100, 50)
    rect(graph, frame.id, 100, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[1].x).toBe(0)
    expect(children[2].x).toBe(120)
  })

  test('hug frame ignores hidden children for sizing', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    rect(graph, frame.id, 200, 200, { visible: false })
    rect(graph, frame.id, 50, 30)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(50)
    expect(f.height).toBe(30)
  })

  test('hidden nested auto-layout children preserve size but collapse in layout', () => {
    const graph = new SceneGraph()
    const outer = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100,
      itemSpacing: 16
    })
    const inner = autoFrame(graph, outer.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 50,
      height: 50,
      visible: false
    })
    rect(graph, inner.id, 30, 30)
    rect(graph, outer.id, 80, 40)

    computeLayout(graph, outer.id)

    const children = graph.getChildren(outer.id)
    const innerNode = getNodeOrThrow(graph, inner.id)
    expect(innerNode.width).toBe(50)
    expect(innerNode.height).toBe(50)
    expect(children[1].x).toBe(0)
  })
})
