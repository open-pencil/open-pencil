import { describe, expect, test } from 'bun:test'

import { computeContentBounds } from '@open-pencil/core/io/formats/raster'
import { SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

function close(
  actual: unknown,
  expected: { minX: number; minY: number; maxX: number; maxY: number }
) {
  expect(actual).toEqual({
    minX: expect.closeTo(expected.minX, 6),
    minY: expect.closeTo(expected.minY, 6),
    maxX: expect.closeTo(expected.maxX, 6),
    maxY: expect.closeTo(expected.maxY, 6)
  })
}

describe('content bounds', () => {
  test('hold a turned frame where it draws, turned about its centre', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      x: 250,
      y: 250,
      width: 300,
      height: 180,
      rotation: 90
    })

    close(computeContentBounds(graph, [frame.id]), { minX: 310, minY: 190, maxX: 490, maxY: 490 })
  })

  test('hold a child of a turned parent where the parent puts it', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const parent = graph.createNode('FRAME', page.id, {
      x: 100,
      y: 100,
      width: 100,
      height: 100,
      rotation: 90,
      clipsContent: false
    })
    const child = graph.createNode('RECTANGLE', parent.id, { x: 120, y: 0, width: 40, height: 10 })
    const corners = Matrix.mapPoints(getWorldMatrix(child, graph), [0, 0, 40, 0, 40, 10, 0, 10])
    const xs = corners.filter((_, index) => index % 2 === 0)
    const ys = corners.filter((_, index) => index % 2 === 1)

    close(computeContentBounds(graph, [child.id]), {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys)
    })
    const both = computeContentBounds(graph, [parent.id])
    expect(both?.minX).toBeCloseTo(Math.min(100, ...xs), 6)
    expect(both?.maxY).toBeCloseTo(Math.max(200, ...ys), 6)
  })

  test('leave out hidden layers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const shown = graph.createNode('RECTANGLE', page.id, { width: 10, height: 10 })
    const hidden = graph.createNode('RECTANGLE', page.id, {
      x: 50,
      width: 10,
      height: 10,
      visible: false
    })

    expect(computeContentBounds(graph, [hidden.id])).toBeNull()
    close(computeContentBounds(graph, [shown.id, hidden.id]), {
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10
    })
  })

  test('leave out hidden children of visible layers', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 100,
      height: 100,
      clipsContent: false
    })
    graph.createNode('RECTANGLE', frame.id, { x: 120, width: 40, height: 10, visible: false })

    close(computeContentBounds(graph, [frame.id]), { minX: 0, minY: 0, maxX: 100, maxY: 100 })
  })
})
