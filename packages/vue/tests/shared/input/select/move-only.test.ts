import { afterEach, describe, expect, test } from 'bun:test'

import type { Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleSelectDown, type HitTestFns } from '#vue/shared/input/select'
import { updateHoverCursor } from '#vue/shared/input/select/hover'
import type { DragState } from '#vue/shared/input/types'

import { createMoveHarness } from '../move/harness'

// A host that lets layers only move (`layerEdits: 'move'`), as a game whose pieces are dragged
// into place: a press drags, but nothing resizes, rotates, copies, or changes parent.

let editor: Editor

afterEach(() => editor.dispose())

function setup() {
  const harness = createMoveHarness()
  editor = harness.editor
  const frame = harness.node('FRAME', harness.page, { x: 200, width: 240, height: 160 })
  const piece = harness.node('RECTANGLE', harness.page, { width: 80, height: 80 })
  let under: SceneNode | null = piece
  const fns: HitTestFns = {
    hitTestLayer: () => under,
    hitTestFrameTitle: () => null,
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }
  const pressAt = (x: number, y: number, target: SceneNode | null, altKey = false) => {
    under = target
    let drag: DragState | null = null
    const press = { shiftKey: false, altKey, metaKey: false, ctrlKey: false } as MouseEvent
    handleSelectDown(
      press,
      x,
      y,
      x,
      y,
      editor,
      fns,
      () => false,
      () => false,
      (next) => {
        drag = next
      }
    )
    return drag as DragState | null
  }
  editor.setHostRestrictions({ layerEdits: 'move' })
  return { ...harness, frame, piece, fns, pressAt }
}

describe('pointer input where layers only move', () => {
  test('a press on a layer drags it, keeping it in its parent', () => {
    const { piece, pressAt } = setup()
    const drag = pressAt(40, 40, piece)
    expect(drag).toMatchObject({ type: 'move', keepParents: true })
  })

  test('a press on a corner handle moves rather than resizes, and shows no resize cursor', () => {
    const { piece, fns, pressAt } = setup()
    editor.select([piece.id])
    expect(updateHoverCursor(80, 80, editor, fns)).toBeNull()
    expect(pressAt(80, 80, piece)?.type).toBe('move')
  })

  test('Alt drags the layer itself, not a copy', () => {
    const { piece, page, childIds, pressAt } = setup()
    editor.select([piece.id])
    expect(pressAt(40, 40, piece, true)).not.toHaveProperty('duplicated', true)
    expect(childIds(page)).toHaveLength(2)
  })

  test('a layer dropped over a frame moves but stays out of it, and undo takes it back', () => {
    const { piece, page, drag, parentOf } = setup()
    drag([piece.id], [40, 40], [300, 80])
    expect(parentOf(piece.id)).toBe(page)
    expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 260, y: 40, width: 80 })

    editor.undoAction()
    expect(editor.graph.getNode(piece.id)).toMatchObject({ x: 0, y: 0 })
  })
})
