import { describe, expect, test } from 'bun:test'

import { createMoveHarness } from './harness'

describe('move history', () => {
  // Undo puts a layer dragged out of a frame back in its old slot, not after its siblings.
  test('undoing a drag out of a frame restores the sibling order', () => {
    const { editor, page, node, drag, parentOf, childIds } = createMoveHarness()
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
    const frame = node('FRAME', page, { x: 100, y: 100, width: 300, height: 100 })
    const [a, b, c] = [0, 1, 2].map((index) =>
      node('RECTANGLE', frame.id, { x: index * 60, y: 10, width: 50, height: 40 })
    )
    drag([b.id], [180, 130], [180, 330])
    expect(parentOf(b.id)).toBe(page)

    editor.undoAction()
    expect(childIds(frame.id)).toEqual([a.id, b.id, c.id])
    expect(editor.graph.getNode(b.id)).toMatchObject({ x: 60, y: 10 })

    editor.redoAction()
    expect(parentOf(b.id)).toBe(page)
    expect(childIds(frame.id)).toEqual([a.id, c.id])
  })
})
