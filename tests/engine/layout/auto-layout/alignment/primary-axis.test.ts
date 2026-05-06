import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('alignment - primary axis', () => {
  test('center alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100,
      primaryAxisAlign: 'CENTER'
    })
    rect(graph, frame.id, 100, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.x).toBe(150)
  })

  test('max alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100,
      primaryAxisAlign: 'MAX'
    })
    rect(graph, frame.id, 100, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.x).toBe(300)
  })

  test('space-between alignment (horizontal)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100,
      primaryAxisAlign: 'SPACE_BETWEEN'
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[2].x).toBe(350)
    expect(children[1].x).toBeCloseTo(175, 0)
  })

  test('center alignment (vertical)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      primaryAxisAlign: 'CENTER'
    })
    rect(graph, frame.id, 50, 100)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.y).toBe(150)
  })

  test('max alignment (vertical)', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400,
      primaryAxisAlign: 'MAX'
    })
    rect(graph, frame.id, 50, 100)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.y).toBe(300)
  })
})
