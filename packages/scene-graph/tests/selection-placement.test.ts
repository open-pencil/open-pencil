import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import {
  getAxisAlignedWorldBounds,
  getWorldMatrix,
  placeInResizedBounds,
  placeRotatedAbout,
  selectionPlacement
} from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Rect } from '@open-pencil/scene-graph/primitives'

function expectRect(actual: Rect, expected: Rect) {
  expect(actual.x).toBeCloseTo(expected.x, 6)
  expect(actual.y).toBeCloseTo(expected.y, 6)
  expect(actual.width).toBeCloseTo(expected.width, 6)
  expect(actual.height).toBeCloseTo(expected.height, 6)
}

describe('placing a layer in resized selection bounds', () => {
  test('scales an unrotated layer’s box with the bounds', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { x: 50, y: 20, width: 50, height: 30 })
    const placement = selectionPlacement(node, graph)

    const rect = placeInResizedBounds(
      placement,
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, width: 200, height: 50 }
    )
    expectRect(rect, { x: 100, y: 10, width: 100, height: 15 })
  })

  test('gives the box in the parent’s space', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { x: 100, y: 100, width: 300, height: 300 })
    const node = graph.createNode('RECTANGLE', frame.id, { x: 10, y: 10, width: 20, height: 20 })
    const placement = selectionPlacement(node, graph)

    // The selection's canvas bounds grow to the right and down from the layer's canvas corner.
    const rect = placeInResizedBounds(
      placement,
      { x: 110, y: 110, width: 20, height: 20 },
      { x: 110, y: 110, width: 40, height: 60 }
    )
    expectRect(rect, { x: 10, y: 10, width: 40, height: 60 })
  })

  test('scales a rotated layer along its own axes and keeps its angle', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    // 100×20 turned a quarter: drawn upright, 20 wide and 100 tall.
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
      rotation: 90
    })
    const from = getAxisAlignedWorldBounds(node, graph)
    const to = { ...from, width: from.width * 2 }
    const rect = placeInResizedBounds(selectionPlacement(node, graph), from, to)

    // Doubling the canvas width widens the layer's own height axis, which now runs across.
    expect(rect.width).toBeCloseTo(100, 6)
    expect(rect.height).toBeCloseTo(40, 6)
    const moved = graph.createNode('RECTANGLE', page.id, { ...rect, rotation: 90 })
    expectRect(getAxisAlignedWorldBounds(moved, graph), to)
  })
})

describe('placing a layer in a rotated selection', () => {
  test('swings the layer’s center about the pivot and turns it by the same angle', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, { x: 100, y: 0, width: 40, height: 20 })
    const placed = placeRotatedAbout(selectionPlacement(node, graph), { x: 0, y: 0 }, 90)

    expect(placed.rotation).toBeCloseTo(90, 6)
    // The center (120, 10) turns a quarter about the origin to (−10, 120).
    const moved = graph.createNode('RECTANGLE', page.id, { ...placed, width: 40, height: 20 })
    const [cx, cy] = Matrix.mapPoints(getWorldMatrix(moved, graph), [20, 10])
    expect(cx).toBeCloseTo(-10, 6)
    expect(cy).toBeCloseTo(120, 6)
  })

  test('a mirrored layer’s rotation runs the other way to turn the same way on the canvas', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', page.id, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      flipX: true
    })
    const placed = placeRotatedAbout(selectionPlacement(node, graph), { x: 20, y: 10 }, 30)
    expect(placed.rotation).toBeCloseTo(-30, 6)
    expect(placed.x).toBeCloseTo(0, 6)
    expect(placed.y).toBeCloseTo(0, 6)
  })
})
