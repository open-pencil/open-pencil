import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

const VIEWPORT = { width: 800, height: 600 }

// Figma's Page Down and Page Up.
describe('page navigation', () => {
  test('moves to the next and previous page and stops at the ends', async () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    const first = editor.state.currentPageId
    const second = editor.graph.addPage('Second').id

    await editor.switchToPreviousPage()
    expect(editor.state.currentPageId).toBe(first)

    await editor.switchToNextPage()
    expect(editor.state.currentPageId).toBe(second)

    await editor.switchToNextPage()
    expect(editor.state.currentPageId).toBe(second)

    await editor.switchToPreviousPage()
    expect(editor.state.currentPageId).toBe(first)
  })
})
