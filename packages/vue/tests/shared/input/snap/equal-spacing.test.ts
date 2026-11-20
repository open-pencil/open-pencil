import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { withEqualSpacing } from '#vue/shared/input/snap/equal-spacing'
import { resolveObjectPixelSnap, type ExplicitSnapTarget } from '#vue/shared/input/snap/resolve'

function rowEditor() {
  const editor = createEditor()
  editor.state.snappingPreferences = { geometry: false, objects: true, pixelGrid: true }
  const page = editor.state.currentPageId
  const targets = [0, 60].map((x) =>
    editor.graph.createNode('RECTANGLE', page, { x, y: 0, width: 40, height: 40 })
  )
  return { editor, targets }
}

function moveSnap(
  editor: ReturnType<typeof createEditor>,
  targets: ReturnType<typeof rowEditor>['targets'],
  bounds: Rect,
  explicit: ExplicitSnapTarget[] = []
) {
  const moving = new Set(['moving'])
  return withEqualSpacing(
    resolveObjectPixelSnap(moving, bounds, targets, editor, explicit),
    moving,
    bounds,
    targets,
    editor
  )
}

describe('equal spacing during a move', () => {
  test('a box beside a row takes the row gap and shows every gap of it', () => {
    const { editor, targets } = rowEditor()
    const snap = moveSnap(editor, targets, { x: 122, y: 0, width: 40, height: 40 })
    expect(snap.correction.x).toBe(-2)
    expect(snap.guides.filter((guide) => guide.axis === 'x').map((guide) => guide.spacing)).toEqual(
      [20, 20]
    )
  })

  test('an edge alignment that lands closer keeps the axis', () => {
    const { editor, targets } = rowEditor()
    const other = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 123,
      y: 300,
      width: 40,
      height: 40
    })
    const snap = moveSnap(editor, [...targets, other], { x: 122, y: 0, width: 40, height: 40 })
    expect(snap.correction.x).toBe(1)
    expect(snap.guides.some((guide) => guide.spacing !== undefined)).toBe(false)
  })

  test('a canvas guide on the axis keeps it', () => {
    const { editor, targets } = rowEditor()
    const guide: ExplicitSnapTarget = {
      kind: 'canvas-guide',
      axis: 'x',
      position: 125,
      from: -1e6,
      to: 1e6
    }
    const snap = moveSnap(editor, targets, { x: 122, y: 0, width: 40, height: 40 }, [guide])
    expect(snap.correction.x).toBe(3)
    expect(snap.guides.some((entry) => entry.spacing !== undefined)).toBe(false)
  })

  test('turning off snapping to objects turns equal spacing off', () => {
    const { editor, targets } = rowEditor()
    editor.state.snappingPreferences = { geometry: false, objects: false, pixelGrid: true }
    const snap = moveSnap(editor, targets, { x: 122, y: 0, width: 40, height: 40 })
    expect(snap.guides).toEqual([])
    expect(snap.correction.x).toBe(0)
  })
})
