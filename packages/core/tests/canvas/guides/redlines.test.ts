import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { computeGuideRedline } from '#core/canvas/guides/redlines'

function setup() {
  const graph = new SceneGraph()
  const page = graph.getNode(graph.rootId)
  if (!page) throw new Error('Expected page')
  const frame = graph.createNode('FRAME', page.id, { x: 100, y: 100, width: 300, height: 200 })
  graph.createNode('RECTANGLE', frame.id, { x: 50, y: 40, width: 80, height: 60 })
  return { graph, pageId: page.id, frameId: frame.id }
}

describe('guide redlines', () => {
  test('measures from a guide outside a top-level frame to its nearest edge', () => {
    const { graph, pageId, frameId } = setup()
    expect(computeGuideRedline(graph, pageId, frameId, 'x', 40)).toEqual({
      segment: { axis: 'x', from: 40, to: 100, cross: 200, value: 60 },
      targetId: frameId
    })
  })

  test('measures from an intersecting guide to frame children', () => {
    const { graph, pageId, frameId } = setup()
    const redline = computeGuideRedline(graph, pageId, frameId, 'x', 120)
    expect(redline?.segment).toMatchObject({ axis: 'x', from: 120, to: 150, value: 30 })
  })

  test('only accepts top-level selected frames', () => {
    const { graph, pageId, frameId } = setup()
    const nested = graph.createNode('FRAME', frameId)
    expect(computeGuideRedline(graph, pageId, nested.id, 'x', 0)).toBeNull()
  })
})
