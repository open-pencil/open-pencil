import { describe, expect, test } from 'bun:test'

import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

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

test('a turned row measures the drag along its own axes', () => {
  for (const [axis, stays] of [
    ['along', true],
    ['across', false]
  ] as const) {
    const harness = createMoveHarness()
    const { editor, page, node } = harness
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: false }
    const frame = node('FRAME', page, {
      x: 300,
      y: 300,
      rotation: 90,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 10,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 10,
      paddingBottom: 10
    })
    const [, b] = [0, 1, 2].map((i) =>
      node('RECTANGLE', frame.id, { name: 'ABC'[i], width: 60, height: 40 })
    )
    editor.runLayoutForNode(frame.id)
    const world = getWorldMatrix(frame, editor.graph)
    const toCanvas = (x: number, y: number) => Matrix.mapPoint(world, { x, y })
    const start = toCanvas(b.x + 30, b.y + 20)
    // 10 past the frame's end along the row, or past its bottom across it, in the frame's own space.
    const end =
      axis === 'along'
        ? toCanvas(frame.width + 10 + 30, b.y + 20)
        : toCanvas(b.x + 30, frame.height + 10 + 20)
    harness.drag([b.id], [start.x, start.y], [end.x, end.y])
    expect(harness.parentOf(b.id) === frame.id).toBe(stays)
  }
})
