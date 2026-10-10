import { describe, expect, test } from 'bun:test'

import { createMoveHarness } from './harness'

// Distances from Figma desktop 126: a child dragged by its centre out of a row of 60 × 40
// layers with padding and gap 10, until the drop leaves the row.
function row(width = 60) {
  const harness = createMoveHarness()
  const { editor, page, node } = harness
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frame = node('FRAME', page, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  })
  const [, b] = [60, width, 60].map((w, i) => node('RECTANGLE', frame.id, { name: 'ABC'[i], width: w, height: 40 }))
  editor.runLayoutForNode(frame.id)
  const center: [number, number] = [b.x + b.width / 2, b.y + b.height / 2]
  return { ...harness, frame, b, center }
}

describe('dragging a layer out of an auto layout row', () => {
  test('across the row it leaves once its edge is 5 past the frame', () => {
    for (const [past, stays] of [
      [25, true],
      [26, false]
    ] as const) {
      const { frame, b, center, drag, parentOf } = row()
      drag([b.id], center, [center[0], frame.height + past])
      expect(parentOf(b.id) === frame.id).toBe(stays)
    }
  })

  test('along the row it leaves once its edge is about 15 past the frame', () => {
    for (const [width, past, stays] of [
      [60, 40, true],
      [60, 50, false],
      [100, 60, true],
      [100, 70, false]
    ] as const) {
      const { frame, b, center, drag, parentOf } = row(width)
      drag([b.id], center, [frame.width + past, center[1]])
      expect(parentOf(b.id) === frame.id).toBe(stays)
    }
  })
})
