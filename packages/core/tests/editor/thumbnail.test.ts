import { afterEach, describe, expect, test } from 'bun:test'

import { documentThumbnailId, setDocumentThumbnail } from '@open-pencil/scene-graph/thumbnail'

import { createEditor, ReadOnlyDocumentError, type Editor } from '#core/editor'

let editor: Editor

afterEach(() => editor.dispose())

function withFrames() {
  editor = createEditor()
  const pageId = editor.state.currentPageId
  const cover = editor.graph.createNode('FRAME', pageId, { name: 'Cover' })
  const shape = editor.graph.createNode('RECTANGLE', pageId, { name: 'Shape' })
  return { cover, shape }
}

describe('Set as thumbnail', () => {
  test('chooses a frame as one undo step, and Restore default thumbnail clears it', () => {
    const { cover } = withFrames()
    expect(editor.setDocumentThumbnailNode(cover.id)).toBe(true)
    expect(editor.getDocumentThumbnail()).toBe(cover.id)
    editor.undoAction()
    expect(editor.getDocumentThumbnail()).toBeNull()
    editor.redoAction()
    expect(editor.getDocumentThumbnail()).toBe(cover.id)
    expect(editor.setDocumentThumbnailNode(null)).toBe(true)
    expect(editor.getDocumentThumbnail()).toBeNull()
  })

  test('undo puts back a choice whose layer is not loaded', () => {
    const { cover } = withFrames()
    // A frame on a page not loaded yet: stored, but not in the graph.
    setDocumentThumbnail(editor.graph, '99:1')
    expect(editor.getDocumentThumbnail()).toBeNull()
    editor.setDocumentThumbnailNode(cover.id)
    editor.undoAction()
    expect(documentThumbnailId(editor.graph)).toBe('99:1')
  })

  test('refuses a layer that cannot be a thumbnail, and the one already chosen', () => {
    const { cover, shape } = withFrames()
    expect(editor.setDocumentThumbnailNode(shape.id)).toBe(false)
    editor.setDocumentThumbnailNode(cover.id)
    expect(editor.setDocumentThumbnailNode(cover.id)).toBe(false)
  })

  test('a read-only document keeps its thumbnail', () => {
    const { cover } = withFrames()
    editor.setReadOnly(true)
    expect(() => editor.setDocumentThumbnailNode(cover.id)).toThrow(ReadOnlyDocumentError)
    expect(editor.getDocumentThumbnail()).toBeNull()
  })
})
