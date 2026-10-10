import { describe, expect, test } from 'bun:test'

import { createMoveHarness } from './harness'

// Margins from Figma desktop 126: a child dragged by its centre out of a flow of 60 × 40 layers
// with padding and gap 10 leaves once its near edge is 5 past the frame across the flow, and
// about 15 along it.
function flow(layoutMode: 'HORIZONTAL' | 'VERTICAL', width = 60) {
  const harness = createMoveHarness()
  const { editor, page, node } = harness
  editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
  const frame = node('FRAME', page, {
    layoutMode,
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  })
  const [, b] = [60, width, 60].map((w, i) =>
    node('RECTANGLE', frame.id, { name: 'ABC'[i], width: w, height: 40 })
  )
  editor.runLayoutForNode(frame.id)
  const center: [number, number] = [b.x + b.width / 2, b.y + b.height / 2]
  /** Drags B by its centre until its edge is `past` beyond the frame's right or bottom edge. */
  const dragPast = (side: 'right' | 'bottom', past: number) => {
    const to: [number, number] =
      side === 'right'
        ? [frame.width + past + b.width / 2, center[1]]
        : [center[0], frame.height + past + b.height / 2]
    harness.drag([b.id], center, to)
    return harness.parentOf(b.id) === frame.id
  }
  return { dragPast }
}

describe('dragging a layer out of an auto layout flow', () => {
  for (const [layoutMode, across, along] of [
    ['HORIZONTAL', 'bottom', 'right'],
    ['VERTICAL', 'right', 'bottom']
  ] as const) {
    test(`${layoutMode}: across the flow it leaves once its edge is past the frame by more than 5`, () => {
      expect(flow(layoutMode).dragPast(across, 5)).toBe(true)
      expect(flow(layoutMode).dragPast(across, 5.5)).toBe(false)
    })

    test(`${layoutMode}: along the flow it leaves once its edge is past the frame by more than 15`, () => {
      expect(flow(layoutMode).dragPast(along, 15)).toBe(true)
      expect(flow(layoutMode).dragPast(along, 15.5)).toBe(false)
    })
  }
})
