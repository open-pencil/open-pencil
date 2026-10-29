import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'

import { handleSelectDown, type HitTestFns } from '#vue/shared/input/select'
import { updateHoverCursor } from '#vue/shared/input/select/hover'
import type { DragState } from '#vue/shared/input/types'

// Figma desktop, version history open (2026-10-17): a press selects, nothing moves or resizes,
// and selected layers show no handles to drag.

let editor: Editor

afterEach(() => editor.dispose())

const press = { shiftKey: false, altKey: false, metaKey: false, ctrlKey: false } as MouseEvent

function setup() {
  editor = createEditor()
  const pageId = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', pageId, { width: 240, height: 160 })
  const rect = editor.graph.createNode('RECTANGLE', frame.id, {
    x: 40,
    y: 40,
    width: 80,
    height: 80
  })
  let under: SceneNode | null = rect
  const fns: HitTestFns = {
    hitTestInScope: () => under,
    isInsideContainerBounds: () => false,
    hitTestFrameTitle: () => null,
    hitTestSectionTitle: () => null,
    hitTestComponentLabel: () => null
  }
  const pressAt = (x: number, y: number, target: SceneNode | null) => {
    under = target
    let drag: DragState | null = null
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
  editor.setReadOnly(true)
  return { frame, rect, fns, pressAt }
}

describe('pointer input on a read-only document', () => {
  test('a press on a layer selects it and starts no move', () => {
    const { rect, pressAt } = setup()
    expect(pressAt(80, 80, rect)).toBeNull()
    expect([...editor.state.selectedIds]).toEqual([rect.id])
  })

  test('a press on a corner handle starts no resize', () => {
    const { rect, pressAt } = setup()
    editor.select([rect.id])
    expect(pressAt(120, 120, rect)?.type).not.toBe('resize')
  })

  test('a press inside a selected frame selects the layer under it', () => {
    const { frame, rect, pressAt } = setup()
    editor.select([frame.id])
    expect(pressAt(80, 80, rect)).toBeNull()
    expect([...editor.state.selectedIds]).toEqual([rect.id])
  })

  test('a press on empty canvas still draws a marquee', () => {
    const { pressAt } = setup()
    expect(pressAt(400, 400, null)?.type).toBe('marquee')
  })

  test('hovering a corner shows no resize or rotation cursor', () => {
    const { rect, fns } = setup()
    editor.select([rect.id])
    expect(updateHoverCursor(120, 120, editor, fns)).toBeNull()
    expect(updateHoverCursor(128, 128, editor, fns)).toBeNull()
  })
})
