import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

let editor: Editor

afterEach(() => editor.dispose())

/** Three rectangles on the page, bottom to top. */
function setup() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const [a, b, c] = [0, 1, 2].map(
    (i) =>
      editor.graph.createNode('RECTANGLE', page, { x: i * 100, y: 0, width: 50, height: 50 }).id
  )
  return { page, a, b, c }
}

function node(id: string) {
  const found = editor.graph.getNode(id)
  if (!found) throw new Error('missing layer')
  return found
}

describe('layer state undo', () => {
  test('hiding the selection undoes in one step and redoes', () => {
    const { a, b } = setup()
    editor.select([a, b])
    editor.toggleVisibility()
    expect([node(a).visible, node(b).visible]).toEqual([false, false])
    editor.undo.undo()
    expect([node(a).visible, node(b).visible]).toEqual([true, true])
    editor.undo.redo()
    expect([node(a).visible, node(b).visible]).toEqual([false, false])
  })

  test('locking from the layers panel undoes', () => {
    const { a } = setup()
    editor.toggleNodeLock(a)
    expect(node(a).locked).toBe(true)
    editor.undo.undo()
    expect(node(a).locked).toBe(false)
  })

  test('renaming undoes, and an unchanged name records nothing', () => {
    const { a } = setup()
    const original = node(a).name
    editor.renameNode(a, 'Card')
    editor.renameNode(a, ' Card ')
    editor.undo.undo()
    expect(node(a).name).toBe(original)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('moving to another page undoes back to each layer’s place in the stack', () => {
    const { page, a, b, c } = setup()
    const other = editor.addPage('Other')
    editor.select([a, c])
    editor.moveToPage(other)
    expect(node(page).childIds).toEqual([b])
    editor.undo.undo()
    expect(node(page).childIds).toEqual([a, b, c])
    expect(node(c).x).toBe(200)
    editor.undo.redo()
    expect(node(other).childIds).toEqual([a, c])
  })
})
