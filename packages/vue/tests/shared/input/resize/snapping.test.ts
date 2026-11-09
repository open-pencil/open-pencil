import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

function setup(
  handle: DragResize['handle'] = 'se',
  box: Rect = {
    x: 10.25,
    y: 20.25,
    width: 100,
    height: 80
  }
) {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const node = editor.graph.createNode('RECTANGLE', pageId, box)
  editor.select([node.id])
  const drag: DragResize = {
    type: 'resize',
    handle,
    startX: handle.includes('w') ? node.x : node.x + node.width,
    startY: handle.includes('n') ? node.y : node.y + node.height,
    origRect: { x: node.x, y: node.y, width: node.width, height: node.height },
    nodeId: node.id,
    origVectorNetwork: null,
    origFillGeometry: [],
    origStrokeGeometry: [],
    origDerivedTextGlyphs: null,
    origStrokes: [],
    origTextPathData: null,
    origTextPathBox: null,
    lockedAspectRatio: null,
    origChildren: null
  }
  return { editor, nodeId: node.id, drag }
}

// Figma desktop (2026-11-08) gives a layer a handle resizes whole-pixel sides at any zoom: the
// edges the handle leaves stay where they are, so a fractional position survives.
describe('resize snapping preferences', () => {
  test('rounds the size to whole pixels however far zoomed in', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }
    editor.state.zoom = 16

    applyResize(drag, drag.startX + 0.6, drag.startY + 0.6, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ x: 10.25, y: 20.25, width: 101, height: 81 })
  })

  test('preserves fractional edges when pixel snapping is disabled', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: false }

    applyResize(drag, drag.startX + 6.3, drag.startY + 7.4, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ width: 106.3, height: 87.4 })
  })

  test('rounds the size when the east and south edges move', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }

    applyResize(drag, drag.startX + 6.3, drag.startY + 7.4, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ x: 10.25, y: 20.25, width: 106, height: 87 })
  })

  test('rounds the size from the west edge, keeping the east edge', () => {
    const { editor, nodeId, drag } = setup('w')
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }

    applyResize(drag, drag.startX + 4.3, drag.startY, false, editor)
    commitResizePreview(drag, editor)

    const resized = editor.graph.getNode(nodeId)
    expect(resized?.width).toBe(96)
    expect(resized?.x).toBeCloseTo(14.25)
  })

  // Measured on a 151.25 × 33.333333 layer at x 9000.375: right +3.5 gave 155 × 33, left -10
  // gave x 8990.625 and 161 wide, and a press without moving changed nothing.
  test('rounds the side the handle leaves, and a still press changes nothing', () => {
    const box = { x: 400.375, y: 110, width: 151.25, height: 33.333333 }
    const right = setup('e', box)
    right.editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }
    applyResize(right.drag, right.drag.startX + 3.5, right.drag.startY, false, right.editor)
    commitResizePreview(right.drag, right.editor)
    expect(right.editor.graph.getNode(right.nodeId)).toMatchObject({
      x: 400.375,
      y: 110,
      width: 155,
      height: 33
    })

    const left = setup('w', box)
    left.editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }
    applyResize(left.drag, left.drag.startX - 10, left.drag.startY, false, left.editor)
    commitResizePreview(left.drag, left.editor)
    expect(left.editor.graph.getNode(left.nodeId)).toMatchObject({ x: 390.625, width: 161 })

    const still = setup('e', box)
    still.editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }
    applyResize(still.drag, still.drag.startX, still.drag.startY, false, still.editor)
    commitResizePreview(still.drag, still.editor)
    expect(still.editor.graph.getNode(still.nodeId)).toMatchObject(box)
    expect(still.editor.undo.canUndo).toBe(false)
  })

  test('Control bypass preserves fractional resize geometry', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }

    applyResize(drag, drag.startX + 6.3, drag.startY + 7.4, false, editor, true)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ width: 106.3, height: 87.4 })
    expect(editor.state.snapGuides).toEqual([])
  })

  test('does not apply axis-aligned snapping to rotated resize geometry', () => {
    const { editor, nodeId, drag } = setup('e')
    editor.updateNode(nodeId, { rotation: 30 })
    editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 150,
      y: 0,
      width: 50,
      height: 50
    })

    applyResize(drag, 148, drag.startY, false, editor)
    commitResizePreview(drag, editor)

    // The handle works along the layer's own axis: 37.75 across the canvas is 37.75 · cos 30° along it.
    expect(editor.graph.getNode(nodeId)?.width).toBeCloseTo(100 + 37.75 * Math.cos(Math.PI / 6))
    expect(editor.state.snapGuides).toEqual([])
  })

  test('a mirrored layer snaps the edge its handle moves', () => {
    // Mirrored, the layer's own right handle is the edge at canvas x 10.25.
    const { editor, nodeId, drag } = setup('e')
    editor.updateNode(nodeId, { flipX: true })
    editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: false }
    editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: -50,
      y: 0,
      width: 50,
      height: 50
    })
    const press = { ...drag, startX: 10.25 }
    // Dragged 7.25 left on the canvas, the edge lands 3 short of the neighbour's right edge at 0.
    applyResize(press, 3, press.startY, false, editor)
    expect(editor.state.snapGuides.length).toBeGreaterThan(0)
    commitResizePreview(press, editor)

    expect(editor.graph.getNode(nodeId)?.width).toBeCloseTo(110.25)
  })

  test('object edges take priority over the pixel grid', () => {
    const { editor, nodeId, drag } = setup('e')
    const pageId = editor.state.currentPageId
    editor.graph.createNode('RECTANGLE', pageId, { x: 150.4, y: 0, width: 50, height: 50 })

    applyResize(drag, 148, drag.startY, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ width: 140.15 })
  })
})
