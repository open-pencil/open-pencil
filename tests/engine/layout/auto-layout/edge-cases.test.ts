import { describe, expect, test } from 'bun:test'

import { computeLayout } from '@open-pencil/core/layout'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('edge cases', () => {
  test('an empty hugging frame keeps its size, padding or not, as Figma keeps it', () => {
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
    expect(f.width).toBe(400)
    expect(f.height).toBe(200)
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

  test('a hugging frame whose children are all absolute keeps its size', () => {
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

    // Nothing is in its flow to hug, so it keeps the size it has.
    const f = getNodeOrThrow(graph, frame.id)
    expect(f.width).toBe(400)
    expect(f.height).toBe(200)
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
