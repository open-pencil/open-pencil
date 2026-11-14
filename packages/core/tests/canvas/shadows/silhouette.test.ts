import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { shadowIncludesChildren } from '#core/canvas/shadows/silhouette'

const RED = { type: 'SOLID' as const, color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }

// A 100 × 100 frame whose top-left corner is a 100px arc: a child at 4,38 lies outside it, so the
// frame's own fill does not cover the child and its shadow has to include it. A corner clamped to
// half the box, a 50px arc, would take the child as covered.
test("a container's shadow includes a child its fitted corner leaves uncovered", () => {
  const graph = new SceneGraph()
  const frame = graph.createNode('FRAME', graph.getPages()[0].id, {
    width: 100,
    height: 100,
    fills: [RED],
    clipsContent: false,
    independentCorners: true,
    topLeftRadius: 100
  })
  graph.createNode('RECTANGLE', frame.id, { x: 4, y: 38, width: 2, height: 2, fills: [RED] })
  const node = graph.getNode(frame.id)
  if (!node) throw new Error('no frame')
  expect(shadowIncludesChildren(graph, node)).toBe(true)
})
