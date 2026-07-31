import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function svgFile(name = 'mark.svg', width = 40, height = 20) {
  return new File(
    [
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f00"/></svg>`
    ],
    name,
    { type: 'image/svg+xml' }
  )
}

describe('dropped file placement', () => {
  test('places files in order with one selection and undo entry', async () => {
    const editor = createEditor()

    await editor.placeFiles([svgFile(), svgFile('symbol.svg', 20, 10)], 200, 100)

    const roots = editor.graph.getChildren(editor.state.currentPageId)
    expect(roots.map((node) => node.name)).toEqual(['mark', 'symbol'])
    expect(roots.map((node) => node.x)).toEqual([160, 220])
    expect([...editor.state.selectedIds]).toEqual(roots.map((node) => node.id))
    expect(editor.undo.undoLabel).toBe('Place files')

    editor.undoAction()
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
    expect(editor.state.selectedIds.size).toBe(0)

    editor.redoAction()
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(2)
    expect(editor.state.selectedIds.size).toBe(2)
  })

  test('reads every file before mutating the graph', async () => {
    const editor = createEditor()
    const unreadable = {
      name: 'broken.svg',
      type: 'image/svg+xml',
      text: () => Promise.reject(new Error('read failed'))
    } as File

    await expect(editor.placeFiles([svgFile(), unreadable], 200, 100)).rejects.toThrow(
      'read failed'
    )
    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(0)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('accepts an SVG filename when the drag source omits its MIME type', async () => {
    const editor = createEditor()
    const file = new File(
      ['<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="5"/></svg>'],
      'fallback.SVG'
    )

    await editor.placeFiles([file], 50, 50)

    const frame = editor.graph.getChildren(editor.state.currentPageId)[0]
    expect(frame.name).toBe('fallback')
    expect(frame.type).toBe('FRAME')
  })
})
