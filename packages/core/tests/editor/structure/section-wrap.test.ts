import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'

// Measured in FigJam: Wrap in new section leaves 48 units around the layers and numbers the section.
describe('wrapping layers in a new section', () => {
  test('spans them with 48 units of room, named and selected, in one undo step', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const a = editor.createShape('RECTANGLE', 100, 100, 100, 100, pageId)
    const b = editor.createShape('RECTANGLE', 400, 140, 100, 100, pageId)
    editor.select([a, b])
    const id = editor.wrapSelectionInSection()
    const section = expectDefined(id ? editor.graph.getNode(id) : undefined)
    expect(section).toMatchObject({ type: 'SECTION', name: 'Section 1', x: 52, y: 52, width: 496, height: 236 })
    expect(section.childIds).toEqual([a, b])
    expect([...editor.state.selectedIds]).toEqual([section.id])
    editor.undo.undo()
    expect(editor.graph.getNode(a)?.parentId).toBe(pageId)
  })

  test('a board paints it as a light section, whatever the interface theme', () => {
    const editor = createEditor()
    editor.state.theme = 'dark'
    editor.setDocumentKind('board')
    const pageId = editor.state.currentPageId
    const a = editor.createShape('RECTANGLE', 100, 100, 100, 100, pageId)
    editor.select([a])
    const id = editor.wrapSelectionInSection()
    const drawn = editor.createShape('SECTION', 600, 0, 200, 200, pageId)
    const light = createEditor()
    light.state.theme = 'light'
    const expected = light.graph.getNode(light.createShape('SECTION', 0, 0, 10, 10, light.state.currentPageId))?.fills
    expect(id ? editor.graph.getNode(id)?.fills : null).toEqual(expected)
    expect(editor.graph.getNode(drawn)?.fills).toEqual(expected)
  })
})
