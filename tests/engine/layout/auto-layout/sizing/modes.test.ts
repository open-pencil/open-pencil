import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('sizing modes', () => {
  test('hug contents horizontally', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 999,
      height: 100,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 50)
    rect(graph, frame.id, 70, 50)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(130)
  })

  test('hug contents vertically', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 200,
      height: 999,
      itemSpacing: 10
    })
    rect(graph, frame.id, 50, 40)
    rect(graph, frame.id, 50, 60)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.height).toBe(110)
  })

  test('hug includes padding', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      width: 999,
      height: 999,
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 30,
      paddingLeft: 40
    })
    rect(graph, frame.id, 100, 50)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(160)
    expect(f.height).toBe(90)
  })

  test('child fill in horizontal layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100
    })
    rect(graph, frame.id, 100, 50)
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(100)
    expect(children[1].width).toBe(300)
  })

  test('child fill in vertical layout', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      layoutMode: 'VERTICAL',
      width: 200,
      height: 400
    })
    rect(graph, frame.id, 50, 100)
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].height).toBe(100)
    expect(children[1].height).toBe(300)
  })

  test('multiple fill children share space equally', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 300,
      height: 100
    })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(100)
    expect(children[1].width).toBe(100)
    expect(children[2].width).toBe(100)
  })

  test('fill with spacing and padding', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 400,
      height: 100,
      paddingLeft: 20,
      paddingRight: 20,
      itemSpacing: 10
    })
    rect(graph, frame.id, 100, 50)
    rect(graph, frame.id, 50, 50, { layoutGrow: 1 })

    computeLayout(graph, frame.id)

    const children = graph.getChildren(frame.id)
    expect(children[0].width).toBe(100)
    // 400 - 20 - 20 (padding) - 100 (fixed child) - 10 (spacing) = 250
    expect(children[1].width).toBe(250)
  })
})
