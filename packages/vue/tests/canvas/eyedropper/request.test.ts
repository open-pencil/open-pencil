import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import {
  handleEyedropperDown,
  holdsPickerOpen,
  requestEyedropperSample
} from '#vue/canvas/eyedropper'

let editor: Editor

afterEach(() => editor.dispose())

describe('requestEyedropperSample', () => {
  test('switches to the eyedropper and holds the picker open while it waits', () => {
    editor = createEditor()
    expect(holdsPickerOpen(editor)).toBe(false)
    void requestEyedropperSample(editor)
    expect(editor.state.activeTool).toBe('EYEDROPPER')
    expect(holdsPickerOpen(editor)).toBe(true)
  })

  test('resolves null when the user leaves the eyedropper', async () => {
    editor = createEditor()
    const sample = requestEyedropperSample(editor)
    editor.setTool('SELECT')
    expect(await sample).toBeNull()
    expect(holdsPickerOpen(editor)).toBe(true)
  })

  test('a click without a renderer answers the request with no color and returns to Move', async () => {
    editor = createEditor()
    const sample = requestEyedropperSample(editor)
    handleEyedropperDown(editor, 10, 10, false)
    expect(await sample).toBeNull()
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('a new request cancels the one still waiting', async () => {
    editor = createEditor()
    const first = requestEyedropperSample(editor)
    void requestEyedropperSample(editor)
    expect(await first).toBeNull()
    expect(editor.state.activeTool).toBe('EYEDROPPER')
  })
})
