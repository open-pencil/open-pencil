import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

let editor: Editor

afterEach(() => editor.dispose())

function requireNode(id: string) {
  const found = editor.graph.getNode(id)
  if (!found) throw new Error('missing layer')
  return found
}

/** Place and size of a layer, which auto layout is responsible for updating. */
function box(id: string) {
  const node = requireNode(id)
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

describe('duplicating inside auto layout', () => {
  test('places the copy in the flow and hugs the parent, then undo and redo do too', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const left = editor.graph.createNode('FRAME', page, { x: 0, y: 0, width: 100, height: 80 })
    const right = editor.graph.createNode('FRAME', page, { x: 160, y: 0, width: 100, height: 80 })
    editor.select([left.id, right.id])
    const parentId = editor.wrapInAutoLayout()
    if (!parentId) throw new Error('expected an auto layout parent')

    expect(box(parentId)).toEqual({ x: 0, y: 0, width: 200, height: 80 })
    expect(box(left.id)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
    expect(box(right.id)).toEqual({ x: 100, y: 0, width: 100, height: 80 })

    editor.select([right.id])
    editor.duplicateSelected()
    const copyId = [...editor.state.selectedIds][0]
    if (!copyId || copyId === right.id) throw new Error('expected the duplicate to be selected')

    expect(requireNode(parentId).childIds).toEqual([left.id, right.id, copyId])
    expect(box(parentId)).toEqual({ x: 0, y: 0, width: 300, height: 80 })
    expect(box(left.id)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
    expect(box(right.id)).toEqual({ x: 100, y: 0, width: 100, height: 80 })
    expect(box(copyId)).toEqual({ x: 200, y: 0, width: 100, height: 80 })

    editor.undo.undo()
    expect(editor.graph.getNode(copyId)).toBeUndefined()
    expect(requireNode(parentId).childIds).toEqual([left.id, right.id])
    expect(box(parentId)).toEqual({ x: 0, y: 0, width: 200, height: 80 })
    expect(box(right.id)).toEqual({ x: 100, y: 0, width: 100, height: 80 })
    expect(editor.state.selectedIds).toEqual(new Set([right.id]))

    editor.undo.redo()
    expect(requireNode(parentId).childIds).toEqual([left.id, right.id, copyId])
    expect(box(parentId)).toEqual({ x: 0, y: 0, width: 300, height: 80 })
    expect(box(copyId)).toEqual({ x: 200, y: 0, width: 100, height: 80 })
    expect(editor.state.selectedIds).toEqual(new Set([copyId]))
  })

  test('reflows a vertical hugging parent with spacing when a child is duplicated', () => {
    editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 10,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8
    })
    const top = editor.graph.createNode('RECTANGLE', frame.id, { width: 40, height: 30 })
    const bottom = editor.graph.createNode('RECTANGLE', frame.id, { width: 40, height: 30 })
    editor.runLayoutForNode(frame.id)

    expect(box(frame.id)).toMatchObject({ width: 56, height: 86 })
    expect(box(top.id)).toMatchObject({ x: 8, y: 8 })
    expect(box(bottom.id)).toMatchObject({ x: 8, y: 48 })

    editor.select([bottom.id])
    editor.duplicateSelected()
    const copyId = [...editor.state.selectedIds][0]
    if (!copyId || copyId === bottom.id) throw new Error('expected the duplicate to be selected')

    expect(box(frame.id)).toMatchObject({ width: 56, height: 126 })
    expect(box(top.id)).toMatchObject({ x: 8, y: 8 })
    expect(box(bottom.id)).toMatchObject({ x: 8, y: 48 })
    expect(box(copyId)).toMatchObject({ x: 8, y: 88 })

    editor.undo.undo()
    expect(box(frame.id)).toMatchObject({ width: 56, height: 86 })
    expect(editor.graph.getNode(copyId)).toBeUndefined()

    editor.undo.redo()
    expect(box(frame.id)).toMatchObject({ width: 56, height: 126 })
    expect(box(copyId)).toMatchObject({ x: 8, y: 88 })
  })
})
