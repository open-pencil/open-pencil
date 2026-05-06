import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('layoutAlignSelf extended values', () => {
  test('layoutAlignSelf CENTER positions child at cross-axis center', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'MIN'
    })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'CENTER' as const })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(75)
    expect(children[1].y).toBe(0)
  })

  test('layoutAlignSelf MAX positions child at cross-axis end', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'MIN'
    })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MAX' as const })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(150)
    expect(children[1].y).toBe(0)
  })

  test('layoutAlignSelf MIN overrides parent STRETCH', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 200,
      counterAxisAlign: 'STRETCH'
    })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MIN' as const })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].y).toBe(0)
    expect(children[0].height).toBe(50)
    expect(children[1].height).toBe(200)
  })

  test('layoutAlignSelf in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 400,
      counterAxisAlign: 'MIN'
    })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'CENTER' as const })
    rect(graph, frame.id, 50, 50, { layoutAlignSelf: 'MAX' as const })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(125)
    expect(children[1].x).toBe(250)
  })
})
