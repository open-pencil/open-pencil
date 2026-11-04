import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

import {
  cancelEyedropperSample,
  handleEyedropperDown,
  offersEyedropper,
  requestEyedropperSample
} from '#vue/canvas/eyedropper'

let editor: Editor

afterEach(() => editor.dispose())

describe('requestEyedropperSample', () => {
  test('switches to the eyedropper while it waits', () => {
    editor = createEditor()
    void requestEyedropperSample(editor)
    expect(editor.state.activeTool).toBe('EYEDROPPER')
  })

  test('resolves null when the user leaves the eyedropper', async () => {
    editor = createEditor()
    const sample = requestEyedropperSample(editor)
    editor.setTool('SELECT')
    expect(await sample).toBeNull()
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

  test('cancelling resolves null and brings Move back', async () => {
    editor = createEditor()
    const sample = requestEyedropperSample(editor)
    cancelEyedropperSample(editor)
    expect(await sample).toBeNull()
    expect(editor.state.activeTool).toBe('SELECT')
  })

  test('cancelling without a waiting request leaves the tool alone', () => {
    editor = createEditor()
    editor.setTool('EYEDROPPER')
    cancelEyedropperSample(editor)
    expect(editor.state.activeTool).toBe('EYEDROPPER')
  })

  test('a board does not offer the eyedropper and resolves at once', async () => {
    editor = createEditor()
    editor.setDocumentKind('board')
    expect(offersEyedropper(editor)).toBe(false)
    expect(await requestEyedropperSample(editor)).toBeNull()
    expect(editor.state.activeTool).toBe('SELECT')
  })
})
