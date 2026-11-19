import { describe, expect, test } from 'bun:test'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode, type Stroke } from '@open-pencil/scene-graph'

// Sizes measured in Figma: a hugging vertical auto layout frame with 10 px padding around one
// 50×50 layer, its strokes included in layout or not.
const BLACK: Stroke = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  weight: 4,
  align: 'INSIDE'
}

function frame(overrides: Partial<SceneNode>) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const node = graph.createNode('FRAME', page, {
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingTop: 10,
    paddingRight: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    strokes: [BLACK],
    strokesIncludedInLayout: true,
    ...overrides
  })
  const child = graph.createNode('RECTANGLE', node.id, { width: 50, height: 50 })
  computeAllLayouts(graph)
  return { node, child }
}

describe('strokes included in auto layout', () => {
  test('an inside stroke adds its weight to every side of the padding', () => {
    const { node, child } = frame({})
    expect([node.width, node.height]).toEqual([78, 78])
    expect([child.x, child.y]).toEqual([14, 14])
  })

  test('each side adds its own weight', () => {
    const { node, child } = frame({
      independentStrokeWeights: true,
      borderTopWeight: 8,
      borderRightWeight: 2,
      borderBottomWeight: 6,
      borderLeftWeight: 4
    })
    expect([node.width, node.height]).toEqual([76, 84])
    expect([child.x, child.y]).toEqual([14, 18])
  })

  test('only an included, visible, inside stroke takes room', () => {
    for (const overrides of [
      { strokesIncludedInLayout: false },
      { strokes: [{ ...BLACK, align: 'CENTER' as const }] },
      { strokes: [{ ...BLACK, align: 'OUTSIDE' as const }] },
      { strokes: [{ ...BLACK, visible: false }] }
    ]) {
      const { node, child } = frame(overrides)
      expect([node.width, node.height, child.x, child.y]).toEqual([70, 70, 10, 10])
    }
  })

  test('a fixed frame insets a stretched layer by its stroke', () => {
    const graph = new SceneGraph()
    const node = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      width: 100,
      height: 100,
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10,
      strokes: [BLACK],
      strokesIncludedInLayout: true
    })
    const child = graph.createNode('RECTANGLE', node.id, {
      width: 50,
      height: 50,
      layoutAlignSelf: 'STRETCH'
    })
    computeAllLayouts(graph)
    expect([child.x, child.y, child.width]).toEqual([14, 14, 72])
  })
})

describe('strokes included in auto layout with negative spacing', () => {
  function overlappingRow(strokesIncludedInLayout: boolean) {
    const graph = new SceneGraph()
    const row = graph.createNode('FRAME', graph.getPages()[0].id, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: -10,
      paddingTop: 10,
      paddingRight: 10,
      paddingBottom: 10,
      paddingLeft: 10,
      strokes: [BLACK],
      strokesIncludedInLayout
    })
    const children = [0, 1].map(() =>
      graph.createNode('RECTANGLE', row.id, { width: 50, height: 50 })
    )
    computeAllLayouts(graph)
    return { row, children }
  }

  test('keeps the stroke inset on the side the overlap pads', () => {
    const without = overlappingRow(false)
    const included = overlappingRow(true)

    expect(included.row.width).toBe(without.row.width + 8)
    expect(included.children.map((child) => child.x)).toEqual(
      without.children.map((child) => child.x + 4)
    )
  })
})
