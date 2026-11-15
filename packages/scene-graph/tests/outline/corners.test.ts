import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { SOLID_FILL } from '@open-pencil/test-support/scene'

// Figma desktop (2026-11-14): a 100×100 rectangle with corners 90, 30, 0, 60 draws its top-left
// corner at 60, so a point 16px in from that corner is outside it.
test('hit testing follows a fitted oversized corner', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const rect = graph.createNode('RECTANGLE', page, {
    fills: [SOLID_FILL],
    width: 100,
    height: 100,
    independentCorners: true,
    topLeftRadius: 90,
    topRightRadius: 30,
    bottomLeftRadius: 60
  })
  expect(graph.hitTest(16, 16)).toBeNull()
  expect(graph.hitTest(30, 30)?.id).toBe(rect.id)
})
