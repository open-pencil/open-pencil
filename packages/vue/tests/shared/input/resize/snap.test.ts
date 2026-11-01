import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { applyResize, commitResizePreview } from '#vue/shared/input/resize'
import { tryStartResize } from '#vue/shared/input/resize/start'

// Shift-drags of the south-east corner recorded in live Figma, 2026-10-31.
function shiftDrag(
  kind: 'design' | 'board',
  rect: Rect,
  dx: number,
  dy: number,
  obstacle?: Rect
) {
  const editor = createEditor()
  editor.setDocumentKind(kind)
  editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
  const pageId = editor.state.currentPageId
  const node = editor.graph.createNode('RECTANGLE', pageId, rect)
  if (obstacle) editor.graph.createNode('RECTANGLE', pageId, obstacle)
  editor.select([node.id])
  const startX = rect.x + rect.width
  const startY = rect.y + rect.height
  const drag = tryStartResize(startX, startY, editor)
  if (!drag) throw new Error('No south-east handle')
  applyResize(drag, startX + dx, startY + dy, true, editor)
  commitResizePreview(drag, editor)
  const resized = editor.graph.getNode(node.id)
  return { editor, width: resized?.width, height: resized?.height }
}

describe('a resize that keeps the ratio snaps its driving edge', () => {
  test('on a board, the wider drag lands its right edge on the grid and the height follows', () => {
    const { width, height } = shiftDrag('board', { x: 1264, y: 400, width: 160, height: 96 }, 37, 21)
    expect(width).toBe(192)
    expect(height).toBeCloseTo(115.2)
  })

  test('on a board, the taller drag lands its bottom edge on the grid', () => {
    const square = { x: 1264, y: 400, width: 176, height: 176 }
    expect(shiftDrag('board', square, 23, 60)).toMatchObject({ width: 240, height: 240 })
  })

  test('in a design, both sides end on whole pixels', () => {
    const rect = { x: -200, y: -200, width: 160, height: 96 }
    expect(shiftDrag('design', rect, 37, 21)).toMatchObject({ width: 197, height: 118 })
  })

  test("another layer's edge takes the driving edge before the grid", () => {
    const rect = { x: -200, y: -200, width: 160, height: 96 }
    const edge = { x: 0, y: -250, width: 20, height: 300 }
    expect(shiftDrag('design', rect, 37, 21, edge)).toMatchObject({ width: 200, height: 120 })
  })
})
