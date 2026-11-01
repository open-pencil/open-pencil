import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { HandlePosition } from '@open-pencil/core/geometry'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { applyStickyScale, tryStartStickyScale } from '#vue/shared/input/sticky/scale'

// Corner drags of a 240² note on a FigJam board, recorded in live Figma, 2026-10-31.
function scaleNote(
  at: Vector,
  handle: HandlePosition,
  dx: number,
  dy: number,
  obstacle?: Rect,
  disableSnapping = false
) {
  const editor = createEditor()
  editor.setDocumentKind('board')
  editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
  const pageId = editor.state.currentPageId
  const note = editor.createStickyNote(pageId, { x: 0, y: 0 })
  editor.graph.updateNode(note.id, at)
  if (obstacle) editor.graph.createNode('RECTANGLE', pageId, obstacle)
  editor.select([note.id])
  let startX = at.x + 120
  if (handle.includes('e')) startX = at.x + 240
  if (handle.includes('w')) startX = at.x
  const startY = at.y + (handle.includes('s') ? 240 : 0)
  const drag = tryStartStickyScale(startX, startY, editor)
  if (!drag) throw new Error(`No ${handle} handle`)
  applyStickyScale(drag, startX + dx, startY + dy, editor, disableSnapping)
  drag.commit()
  const scaled = editor.graph.getNode(note.id)
  return { x: scaled?.x, y: scaled?.y, width: scaled?.width, height: scaled?.height }
}

describe('scaling a sticky note by a corner on a board', () => {
  test('lands the dragged edge on the 16-unit grid', () => {
    expect(scaleNote({ x: 1264, y: 400 }, 'se', 37, 37)).toMatchObject({ width: 272, height: 272 })
    expect(scaleNote({ x: 1264, y: 400 }, 'nw', -23, -23)).toMatchObject({
      x: 1248,
      y: 384,
      width: 256
    })
  })

  test('snaps the edge, not the size, for a note off the grid', () => {
    expect(scaleNote({ x: 1269, y: 407 }, 'se', 37, 37)).toMatchObject({ width: 283 })
  })

  test('scales from the bottom edge around its centre, with the bottom on the grid', () => {
    expect(scaleNote({ x: 1264, y: 400 }, 's', 0, 37)).toMatchObject({ x: 1248, y: 400, width: 272 })
  })

  test("takes another layer's edge before the grid", () => {
    const edge = { x: 1523, y: 400, width: 20, height: 280 }
    expect(scaleNote({ x: 1264, y: 400 }, 'se', 21, 21, edge)).toMatchObject({ width: 259 })
  })

  test('shows no snap guide once the note stops at its smallest', () => {
    const editor = createEditor()
    editor.setDocumentKind('board')
    editor.state.snappingPreferences = { geometry: true, objects: true, pixelGrid: true }
    const note = editor.createStickyNote(editor.state.currentPageId, { x: 0, y: 0 })
    editor.graph.updateNode(note.id, { x: 1264, y: 400 })
    editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 1523,
      y: 400,
      width: 20,
      height: 280
    })
    editor.select([note.id])
    const drag = tryStartStickyScale(1504, 640, editor)
    if (!drag) throw new Error('No se handle')
    applyStickyScale(drag, 1504 + 21, 640 + 21, editor)
    expect(editor.state.snapGuides.length).toBeGreaterThan(0)
    // Nearly to the opposite corner: the note stops at a tenth of its size, short of any edge.
    applyStickyScale(drag, 1504 - 230, 640 - 230, editor)
    expect(editor.state.snapGuides).toEqual([])
    drag.commit()
    expect(editor.graph.getNode(note.id)?.width).toBe(24)
  })

  test('Control scales it freely, off the grid', () => {
    expect(scaleNote({ x: 1264, y: 400 }, 'se', 37, 37, undefined, true)).toMatchObject({ width: 277 })
  })
})
