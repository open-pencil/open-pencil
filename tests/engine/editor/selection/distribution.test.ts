import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function positions(editor: ReturnType<typeof createEditor>, ids: string[], axis: 'x' | 'y') {
  return ids.map((id) => editor.graph.getNode(id)?.[axis])
}

describe('distribute nodes', () => {
  test('distributes horizontal spacing while preserving outer bounds', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { x: 80, width: 20, height: 10 })
    const last = editor.graph.createNode('RECTANGLE', pageId, { x: 130, width: 30, height: 10 })

    editor.distributeNodes([first.id, middle.id, last.id], 'horizontal')

    expect(positions(editor, [first.id, middle.id, last.id], 'x')).toEqual([0, 60, 130])
  })

  test('sorts nodes geometrically before distributing vertical spacing', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const bottom = editor.graph.createNode('RECTANGLE', pageId, { y: 100, width: 10, height: 20 })
    const top = editor.graph.createNode('RECTANGLE', pageId, { y: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { y: 70, width: 10, height: 10 })

    editor.distributeNodes([bottom.id, top.id, middle.id], 'vertical')

    expect(positions(editor, [top.id, middle.id, bottom.id], 'y')).toEqual([0, 50, 100])
  })

  test('records distribution in undo history', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { x: 0, width: 10, height: 10 })
    const middle = editor.graph.createNode('RECTANGLE', pageId, { x: 80, width: 20, height: 10 })
    const last = editor.graph.createNode('RECTANGLE', pageId, { x: 130, width: 30, height: 10 })
    const ids = [first.id, middle.id, last.id]

    editor.distributeNodes(ids, 'horizontal')
    expect(positions(editor, ids, 'x')).toEqual([0, 60, 130])

    editor.undoAction()
    expect(positions(editor, ids, 'x')).toEqual([0, 80, 130])

    editor.redoAction()
    expect(positions(editor, ids, 'x')).toEqual([0, 60, 130])
  })
})
