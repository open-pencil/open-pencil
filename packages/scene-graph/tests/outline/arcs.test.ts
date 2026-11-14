import { expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { SOLID_FILL } from '@open-pencil/test-support/scene'

// Figma desktop (2026-11-14): an ellipse swept 0.0005 rad short of a whole turn draws whole, so
// the sliver it leaves out is hit like the rest of it.
test('hit testing takes a nearly whole arc as a whole ellipse', () => {
  const graph = new SceneGraph()
  const ellipse = graph.createNode('ELLIPSE', graph.getPages()[0].id, {
    fills: [SOLID_FILL],
    width: 100,
    height: 100,
    arcData: { startingAngle: 0, endingAngle: 2 * Math.PI - 0.0005, innerRadius: 0 }
  })
  // Just below the start angle, inside the sliver a partial arc would leave out.
  expect(graph.hitTest(99, 49.99)?.id).toBe(ellipse.id)
})
