import { describe, expect, test } from 'bun:test'

import { autoFrame, pageId, rect } from '#core-tests/helpers/layout'

import { computeAllLayouts, computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('FILL flexBasis', () => {
  test('FILL children with different content sizes get equal width', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })

    const inner1 = autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 50,
      layoutGrow: 1
    })
    rect(graph, inner1.id, 100, 50)

    const inner2 = autoFrame(graph, frame.id, {
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 200,
      height: 50,
      layoutGrow: 1
    })
    rect(graph, inner2.id, 200, 50)

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(200)
    expect(children[1].width).toBe(200)
  })

  test('nested FILL children distribute from zero basis', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100,
      itemSpacing: 0
    })
    autoFrame(graph, frame.id, {
      layoutGrow: 1,
      width: 50,
      height: 100
    })
    autoFrame(graph, frame.id, {
      layoutGrow: 1,
      width: 50,
      height: 100
    })
    autoFrame(graph, frame.id, {
      layoutGrow: 1,
      width: 50,
      height: 100
    })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(100)
    expect(children[1].width).toBe(100)
    expect(children[2].width).toBe(100)
  })

  test('FILL auto-layout children with different padding get equal width', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })

    autoFrame(graph, frame.id, {
      layoutMode: 'VERTICAL',
      layoutGrow: 1,
      height: 100,
      paddingLeft: 0,
      paddingRight: 0
    })
    autoFrame(graph, frame.id, {
      layoutMode: 'VERTICAL',
      layoutGrow: 1,
      height: 100,
      paddingLeft: 40,
      paddingRight: 40
    })

    // The issue's repro lays the page out, not just the row.
    computeAllLayouts(graph, pageId(graph))

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(200)
    expect(children[1].width).toBe(200)
  })

  test('FILL auto-layout children with different padding get equal height', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 100,
      height: 400
    })

    autoFrame(graph, frame.id, {
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      width: 100,
      paddingTop: 0,
      paddingBottom: 0
    })
    autoFrame(graph, frame.id, {
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      width: 100,
      paddingTop: 40,
      paddingBottom: 40
    })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].height).toBe(200)
    expect(children[1].height).toBe(200)
  })

  test('FILL auto-layout children with different padding keep their grow ratio', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })

    autoFrame(graph, frame.id, {
      layoutMode: 'VERTICAL',
      layoutGrow: 1,
      height: 100,
      paddingLeft: 0,
      paddingRight: 0
    })
    autoFrame(graph, frame.id, {
      layoutMode: 'VERTICAL',
      layoutGrow: 2,
      height: 100,
      paddingLeft: 40,
      paddingRight: 40
    })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBeCloseTo(400 / 3, 4)
    expect(children[1].width).toBeCloseTo((2 * 400) / 3, 4)
  })
})
