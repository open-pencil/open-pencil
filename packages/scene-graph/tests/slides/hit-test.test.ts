import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { layerResizes, layerRotates } from '@open-pencil/scene-graph/generated'
import { hitTestSelectable } from '@open-pencil/scene-graph/hit-test'
import { createSlide, createSlideGrid, createSlideRow } from '@open-pencil/scene-graph/slides'

function deck() {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const grid = createSlideGrid(graph, page.id)
  const row = createSlideRow(graph, grid.id)
  graph.updateNode(grid.id, { width: 2160, height: 1320 })
  graph.updateNode(row.id, { x: 240, y: 240, width: 1920, height: 1080 })
  const slide = createSlide(graph, row.id)
  const box = graph.createNode('RECTANGLE', slide.id, {
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
  })
  const click = (x: number, y: number) => hitTestSelectable(graph, x, y, page.id, new Set())
  return { box, grid, row, slide, click }
}

describe('clicking in a deck', () => {
  test('a click takes a layer on a slide, and nothing on its empty area', () => {
    const { box, click } = deck()
    expect(click(440, 440)?.id).toBe(box.id)
    expect(click(1500, 1000)).toBeNull()
  })

  test('the grid and its rows are never taken', () => {
    const { click } = deck()
    expect(click(20, 20)).toBeNull()
  })

  test('slides and what holds them keep their size and stay upright', () => {
    const { grid, row, slide } = deck()
    for (const node of [grid, row, slide]) {
      expect(layerResizes(node)).toBe(false)
      expect(layerRotates(node)).toBe(false)
    }
  })
})
