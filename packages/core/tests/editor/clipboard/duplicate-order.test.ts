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

describe('duplicating', () => {
  test('puts the copy directly above its original, also on redo', () => {
    const { page, a, b, c } = setup()
    editor.select([a])
    editor.duplicateSelected()
    const [copy] = editor.state.selectedIds
    expect(node(page).childIds).toEqual([a, copy, b, c])
    editor.undo.undo()
    editor.undo.redo()
    expect(node(page).childIds).toEqual([a, copy, b, c])
  })

  test('stacks several copies above the topmost original, in their order', () => {
    const { page, a, b, c } = setup()
    editor.select([a, b])
    editor.duplicateSelected()
    const copies = node(page).childIds.filter((id) => ![a, b, c].includes(id))
    expect(node(page).childIds).toEqual([a, b, ...copies, c])
    expect(copies.map((id) => node(id).x)).toEqual([0, 100])
  })

  test('stacks the copies like their originals when selected top to bottom', () => {
    const { page, a, b, c } = setup()
    editor.select([c, a])
    editor.duplicateSelected()
    const copies = node(page).childIds.filter((id) => ![a, b, c].includes(id))
    expect(node(page).childIds).toEqual([a, b, c, ...copies])
    expect(copies.map((id) => node(id).x)).toEqual([0, 200])
  })
})
