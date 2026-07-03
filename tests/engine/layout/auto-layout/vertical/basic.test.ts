import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('vertical basic', () => {
  test('positions children top-to-bottom', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 80)
    rect(graph, frame.id, 50, 60)
    rect(graph, frame.id, 50, 100)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(80)
    expect(children[2].y).toBe(140)
  })

  test('applies item spacing vertically', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      itemSpacing: 16
    })
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 50, 40)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[1].y).toBe(56)
    expect(children[2].y).toBe(112)
  })

  test('deleting a trailing child reflows fill siblings in fixed vertical auto-layout', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = autoFrame(graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 300,
      itemSpacing: 0
    })
    rect(graph, frame.id, 300, 40, { name: 'header h40' })
    const body = rect(graph, frame.id, 300, 100, { name: 'body fill', layoutGrow: 1 })
    const footerA = rect(graph, frame.id, 300, 40, { name: 'footerA h40' })
    const footerB = rect(graph, frame.id, 300, 40, { name: 'footerB h40' })

    computeAllLayouts(graph, page)
    expect(getNodeOrThrow(graph, body.id).height).toBe(180)
    expect(getNodeOrThrow(graph, footerA.id).y).toBe(220)

    graph.deleteNode(footerB.id)
    computeAllLayouts(graph, page)

    expect(getNodeOrThrow(graph, body.id).height).toBe(220)
    expect(getNodeOrThrow(graph, footerA.id).y).toBe(260)
    expect(getNodeOrThrow(graph, frame.id).height).toBe(300)
  })
})
