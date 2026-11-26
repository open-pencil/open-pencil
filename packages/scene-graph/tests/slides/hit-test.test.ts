import { describe, expect, test } from 'bun:test'

import { layerResizes, layerRotates } from '#scene-graph/generated'
import { SceneGraph } from '#scene-graph/graph'
import { type DropTargetOptions, hitTestDropTarget, hitTestSelectable } from '#scene-graph/hit-test'
import { createSlide, createSlideGrid, createSlideRow } from '#scene-graph/slides'

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
  const drop = (options?: DropTargetOptions) =>
    hitTestDropTarget(graph, 1000, 1000, new Set(), page.id, options)?.id
  return { box, grid, row, slide, click, drop }
}

test('a slide takes dropped layers, main components among them', () => {
  const { drop, slide } = deck()
  expect(drop()).toBe(slide.id)
  expect(drop({ componentSetIds: new Set() })).toBe(slide.id)
})

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
