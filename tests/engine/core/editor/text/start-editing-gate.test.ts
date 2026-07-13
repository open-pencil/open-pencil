import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

import { fontManager } from '#core/text/fonts'

/**
 * Path text can only be edited when the font's glyph OUTLINES are available to
 * reflow. Unavailable-font path text is a baked graphic: startTextEditing must
 * refuse to enter edit mode (so a keystroke can't corrupt the lettering). Non-
 * path text and available-font path text edit normally.
 */
describe('startTextEditing — path-text font gate', () => {
  test('blocks unavailable-font path text, allows available-font + normal text', async () => {
    const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
    expect(font).toBeTruthy()
    if (!font) return
    fontManager.markLoaded('Inter', 'Regular', font)

    const editor = createEditor()
    const page = editor.state.currentPageId
    const box = { x: 0, y: 0, width: 200, height: 200 }

    // Path text, font AVAILABLE → editable.
    const editable = editor.graph.createNode('TEXT', page, {
      text: 'ab',
      fontFamily: 'Inter',
      fontWeight: 400,
      textPathBox: { ...box }
    })
    editor.startTextEditing(editable.id)
    expect(editor.state.editingTextId).toBe(editable.id)

    // Path text, font UNAVAILABLE → blocked (stays a baked graphic). Starting on
    // it also commits the previous edit, so editingTextId must end up null.
    const baked = editor.graph.createNode('TEXT', page, {
      text: 'ab',
      fontFamily: 'NoSuchFont',
      fontWeight: 400,
      textPathBox: { ...box }
    })
    editor.startTextEditing(baked.id)
    expect(editor.state.editingTextId).toBeNull()

    // Plain text (no path) with an unavailable font → still editable.
    const plain = editor.graph.createNode('TEXT', page, {
      text: 'ab',
      fontFamily: 'NoSuchFont',
      fontWeight: 400
    })
    editor.startTextEditing(plain.id)
    expect(editor.state.editingTextId).toBe(plain.id)
  })
})
