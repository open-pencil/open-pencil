import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import type { DragResize } from '#vue/shared/input/types'

function setup(handle: DragResize['handle'] = 'se') {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const node = editor.graph.createNode('RECTANGLE', pageId, {
    x: 10.25,
    y: 20.25,
    width: 100,
    height: 80
  })
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
    origChildren: null
  }
  return { editor, nodeId: node.id, drag }
}

describe('resize snapping preferences', () => {
  test('preserves fractional edges when pixel snapping is disabled', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: false }

    applyResize(drag, drag.startX + 6.3, drag.startY + 7.4, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ width: 106.3, height: 87.4 })
  })

  test('snaps east and south edges to whole pixels', () => {
    const { editor, nodeId, drag } = setup()
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }

    applyResize(drag, drag.startX + 6.3, drag.startY + 7.4, false, editor)
    commitResizePreview(drag, editor)

    expect(editor.graph.getNode(nodeId)).toMatchObject({ width: 106.75, height: 87.75 })
  })

  test('snaps west edge while preserving the opposite edge', () => {
    const { editor, nodeId, drag } = setup('w')
    editor.state.snappingPreferences = { geometry: true, objects: false, pixelGrid: true }

    applyResize(drag, drag.startX + 4.3, drag.startY, false, editor)
    commitResizePreview(drag, editor)

    const resized = editor.graph.getNode(nodeId)
    expect(resized?.x).toBeCloseTo(15)
    expect(resized?.width).toBeCloseTo(95.25)
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

    expect(editor.graph.getNode(nodeId)?.width).toBeCloseTo(137.75)
    expect(editor.state.snapGuides).toEqual([])
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
