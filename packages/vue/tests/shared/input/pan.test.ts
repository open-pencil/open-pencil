import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import { handlePanMove } from '#vue/canvas/transform/pan'
import { startPanDrag } from '#vue/shared/input/pan/drag'
import type { DragPan } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

function dragPan(): DragPan {
  return {
    type: 'pan',
    startScreenX: 0,
    startScreenY: 0,
    startPanX: 0,
    startPanY: 0
  }
}

function pointer(clientX: number, clientY: number): MouseEvent {
  return { clientX, clientY } as MouseEvent
}

describe('drag pan navigation', () => {
  test('starts a drag pan in the pan phase and advances its generation', () => {
    editor = createEditor()
    const generation = editor.state.navigation.generation
    let drag: DragPan | null = null

    startPanDrag(
      pointer(10, 20),
      (next) => {
        drag = next as DragPan
      },
      editor
    )

    expect(drag).not.toBeNull()
    expect(editor.state.navigation.phase).toBe('pan')
    expect(editor.state.navigation.generation).toBe(generation + 1)
  })

  test('keeps a moving drag pan in the pan phase and refreshes its input time', () => {
    editor = createEditor()
    editor.setNavigationPhase('idle')
    const moved = dragPan()

    handlePanMove(editor, moved, pointer(30, 50))

    expect(editor.state.panX).toBe(30)
    expect(editor.state.panY).toBe(50)
    expect(editor.state.navigation.phase).toBe('pan')
    expect(editor.state.navigation.lastInputAt).toBeGreaterThan(0)
  })
})
