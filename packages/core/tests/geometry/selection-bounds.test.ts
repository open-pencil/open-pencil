import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createSceneGeometry, selectionBounds } from '#core/geometry'

// Figma desktop (2026-11-14): a 100×20 rectangle at 30000,30000 turned 45° shows its axis-aligned
// bounds on the rulers, 30000 to 30084.853 across and 29929.289 to 30014.142 down.
test('a turned layer is bounded by its box on the canvas, as the rulers mark it', () => {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const rectangle = figma.createRectangle()
  rectangle.resize(100, 20)
  rectangle.x = 30000
  rectangle.y = 30000
  rectangle.rotation = 45
  const node = graph.getNode(rectangle.id)
  if (!node) throw new Error('no rectangle')
  const bounds = selectionBounds(createSceneGeometry(graph), [node])
  expect([bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height]).toEqual([
    30000,
    expect.closeTo(29929.289, 3),
    expect.closeTo(30084.853, 3),
    expect.closeTo(30014.142, 3)
  ])
})
