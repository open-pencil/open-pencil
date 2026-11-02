import { describe, expect, test } from 'bun:test'

import { createEditor } from '@lawha/core'
import type { Rect } from '@lawha/scene-graph/primitives'

const VIEWPORT = { width: 800, height: 600 }

/** The world point at the center of the viewport. */
function center(editor: ReturnType<typeof createEditor>) {
  const { panX, panY, zoom } = editor.state
  return { x: (VIEWPORT.width / 2 - panX) / zoom, y: (VIEWPORT.height / 2 - panY) / zoom }
}

describe('zoomToLevel', () => {
  test.each([0.5, 1, 4])('keeps the centered point in place when zooming from 2 to %p', (level) => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    editor.state.zoom = 2
    editor.state.panX = -300
    editor.state.panY = 120
    const before = center(editor)

    editor.zoomToLevel(level)

    expect(editor.state.zoom).toBe(level)
    expect(center(editor)).toEqual(before)
  })
})

describe('centerOn', () => {
  test('puts the point at the center at the given zoom', () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    editor.centerOn(300, 200, 2)
    expect(editor.state.zoom).toBe(2)
    expect(center(editor)).toEqual({ x: 300, y: 200 })
  })

  test('leaves the view alone for a point too far away to represent', () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    const before = { ...center(editor), zoom: editor.state.zoom }
    editor.centerOn(1e308, 0, 256)
    expect({ ...center(editor), zoom: editor.state.zoom }).toEqual(before)
  })
})

/** Where the world point lands on the canvas. */
function screenOf(editor: ReturnType<typeof createEditor>, x: number, y: number) {
  const { panX, panY, zoom } = editor.state
  return { x: x * zoom + panX, y: y * zoom + panY }
}

function withRect(rect: Rect) {
  const editor = createEditor({ getViewportSize: () => VIEWPORT })
  const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, rect)
  return { editor, node }
}

// Insets measured in Figma 126: zoom to fit keeps 45/25 px at the sides and 45/85 px above and
// below the layers, zoom to selection 60/40 and 60/100, both zooming past 100% when the layers
// are small.
describe('zoomToFit', () => {
  test('fills the canvas less the fit insets with every layer, past 100% when they are small', () => {
    const { editor } = withRect({ x: 100, y: 200, width: 300, height: 180 })
    editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 300,
      y: 250,
      width: 100,
      height: 100
    })

    editor.zoomToFit()

    // The 300 × 180 union fits the 730 × 470 area by its width.
    expect(editor.state.zoom).toBeCloseTo(730 / 300, 6)
    expect(screenOf(editor, 250, 290)).toEqual({ x: 45 + 730 / 2, y: 45 + 470 / 2 })
  })

  test('zooms out for layers larger than the canvas', () => {
    const { editor } = withRect({ x: -1000, y: 500, width: 4000, height: 1000 })
    editor.zoomToFit()
    expect(editor.state.zoom).toBeCloseTo(730 / 4000, 6)
  })

  test('stops at the maximum zoom for a point-sized layer and still centres it', () => {
    const { editor } = withRect({ x: 50, y: 50, width: 0, height: 0 })
    editor.zoomToFit()
    expect(editor.state.zoom).toBe(256)
    expect(screenOf(editor, 50, 50)).toEqual({ x: 45 + 730 / 2, y: 45 + 470 / 2 })
  })

  test('fits a rotated layer by the box it draws in', () => {
    const { editor } = withRect({ x: 0, y: 0, width: 400, height: 40 })
    const node = editor.graph.getChildren(editor.state.currentPageId)[0]
    editor.graph.updateNode(node.id, { rotation: 90 })

    editor.zoomToFit()

    // Standing upright, the 400 × 40 bar fits the 470 px tall area by its length.
    expect(editor.state.zoom).toBeCloseTo(470 / 400, 6)
  })

  test('leaves hidden layers and children outside an unclipped frame out of the fit', () => {
    const { editor } = withRect({ x: 100, y: 200, width: 300, height: 180 })
    const page = editor.state.currentPageId
    editor.graph.createNode('RECTANGLE', page, { x: 3000, y: 3000, width: 100, height: 100, visible: false })
    const frame = editor.graph.createNode('FRAME', page, { x: 100, y: 200, width: 300, height: 180, clipsContent: false })
    editor.graph.createNode('RECTANGLE', frame.id, { x: 400, y: 0, width: 100, height: 100 })

    editor.zoomToFit()
    expect(editor.state.zoom).toBeCloseTo(730 / 300, 6)
  })

  test('shows the origin at the centre at 100% on an empty page', () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    editor.state.zoom = 3
    editor.state.panX = 900
    editor.zoomToFit()
    expect(editor.state.zoom).toBe(1)
    expect(center(editor)).toEqual({ x: 0, y: 0 })
  })
})

describe('zoomToSelection', () => {
  test('fits into the whole canvas when it is smaller than the insets', () => {
    const editor = createEditor({ getViewportSize: () => ({ width: 90, height: 150 }) })
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 0,
      y: 0,
      width: 30,
      height: 30
    })
    editor.select([node.id])

    editor.zoomToSelection()

    expect(editor.state.zoom).toBeCloseTo(3, 6)
    expect(editor.state).toMatchObject({ panX: 0, panY: 30 })
  })

  test('fits a rotated layer by the box it draws in', () => {
    const { editor, node } = withRect({ x: 0, y: 0, width: 400, height: 40 })
    editor.graph.updateNode(node.id, { rotation: 90 })
    editor.select([node.id])

    editor.zoomToSelection()

    // Standing upright, the 400 × 40 bar fits the 440 px tall area by its length.
    expect(editor.state.zoom).toBeCloseTo(440 / 400, 6)
  })

  test('fills the canvas less the selection insets with the selected layers', () => {
    const { editor, node } = withRect({ x: 700, y: 500, width: 120, height: 90 })
    editor.select([node.id])

    editor.zoomToSelection()

    // The 120 × 90 layer fits the 700 × 440 area by its height.
    expect(editor.state.zoom).toBeCloseTo(440 / 90, 6)
    expect(screenOf(editor, 760, 545)).toEqual({ x: 60 + 700 / 2, y: 60 + 440 / 2 })
  })
})
