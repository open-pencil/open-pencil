import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

function setup() {
  const editor = createEditor()
  const pageId = editor.graph.getPages()[0].id
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Card' })
  const title = editor.graph.createNode('TEXT', card.id, {
    name: 'Title',
    text: 'Line one\nLine two'
  })
  const other = editor.graph.createNode('TEXT', card.id, { name: 'Other', text: 'Other text' })
  const box = editor.graph.createNode('RECTANGLE', pageId, { name: 'Box' })
  return { editor, card, title, other, box }
}

describe('Copy as text', () => {
  test('copies the characters of one text layer, not its name', () => {
    const { editor, title } = setup()
    expect(editor.copySelectionAsText([title.id])).toBe('Line one\nLine two')
  })

  test('copies nothing for other layers or several layers', () => {
    const { editor, card, title, other, box } = setup()
    expect(editor.copySelectionAsText([card.id])).toBeNull()
    expect(editor.copySelectionAsText([box.id])).toBeNull()
    expect(editor.copySelectionAsText([title.id, other.id])).toBeNull()
    expect(editor.copySelectionAsText([])).toBeNull()
  })
})
