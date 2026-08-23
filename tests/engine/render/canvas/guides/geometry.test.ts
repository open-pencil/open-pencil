import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { distanceToGuideSegment, getGuideScreenSegment } from '#core/canvas/guides/geometry'
import { hitTestGuides } from '#core/canvas/guides/hit-test'

function pageWithGuide(): { graph: SceneGraph; page: SceneNode } {
  const page = {
    id: 'page',
    type: 'CANVAS',
    parentId: null,
    childIds: [],
    guides: [{ id: 'guide', axis: 'x', position: 20 }]
  } as SceneNode
  const graph = new SceneGraph()
  graph.nodes = new Map([['page', page]])
  graph.rootId = 'page'
  return { graph, page }
}

describe('guide screen geometry', () => {
  test('spans page guides across the viewport', () => {
    const { graph, page } = pageWithGuide()
    expect(
      getGuideScreenSegment(graph, page, page.guides[0], {
        panX: 10,
        panY: 0,
        zoom: 2,
        width: 300,
        height: 200
      })
    ).toEqual({ x1: 50, y1: 0, x2: 50, y2: 200 })
  })

  test('measures distance to the bounded segment', () => {
    expect(distanceToGuideSegment(20, 5, { x1: 10, y1: 0, x2: 10, y2: 20 })).toBe(10)
    expect(distanceToGuideSegment(10, 30, { x1: 10, y1: 0, x2: 10, y2: 20 })).toBe(10)
  })

  test('hit tests page guides using screen coordinates', () => {
    const { graph } = pageWithGuide()
    const hit = hitTestGuides(
      graph,
      'page',
      { panX: 10, panY: 0, zoom: 2, width: 300, height: 200 },
      52,
      100
    )
    expect(hit).toMatchObject({ ownerId: 'page', guideId: 'guide', axis: 'x', position: 20 })
  })
})
