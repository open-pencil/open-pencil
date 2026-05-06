import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('alignment - counter axis', () => {
  test('center cross-axis alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'CENTER'
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.y).toBe(75)
  })

  test('max cross-axis alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'MAX'
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.y).toBe(150)
  })

  test('center cross-axis alignment (vertical)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      counterAxisAlign: 'CENTER'
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.x).toBe(75)
  })

  test('stretch cross-axis alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'STRETCH'
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.height).toBe(200)
  })

  test('stretch cross-axis alignment (vertical)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      counterAxisAlign: 'STRETCH'
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.width).toBe(200)
  })
})
