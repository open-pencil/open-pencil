import { describe, expect, test } from 'bun:test'

import { computeLayout, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('edge cases', () => {
  test('empty auto layout frame', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingTop: 10,
      paddingRight: 20,
      paddingBottom: 30,
      paddingLeft: 40
    })

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(60)
    expect(f.height).toBe(40)
  })

  test('single child', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      width: 200,
      height: 100
    })
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const child = graph.getChildren(frame.id)[0]
    expect(child.x).toBe(0)
    expect(child.y).toBe(0)
    expect(child.width).toBe(50)
    expect(child.height).toBe(50)
  })

  test('all children absolute → frame hugs to padding only', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingTop: 5,
      paddingRight: 5,
      paddingBottom: 5,
      paddingLeft: 5
    })
    rect(graph, frame.id, 100, 100, { layoutPositioning: 'ABSOLUTE' })

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(10)
    expect(f.height).toBe(10)
  })

  test('zero-size children', () => {
    const graph = new SceneGraph()
    const frame = autoFrame(graph, pageId(graph), {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    rect(graph, frame.id, 0, 0)
    rect(graph, frame.id, 50, 50)

    computeLayout(graph, frame.id)

    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(50)

    const children = graph.getChildren(frame.id)
    expect(children[0].x).toBe(0)
    expect(children[1].x).toBe(0)
  })
})
