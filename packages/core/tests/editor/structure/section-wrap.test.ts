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
    expect(editor.graph.getNode(b)?.parentId).toBe(pageId)
    expect(editor.graph.getNode(section.id)).toBeUndefined()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([a, b])
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

  test('layers inside a frame are not wrapped, as sections live only on pages and in sections', () => {
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, { width: 400, height: 400 })
    const a = editor.createShape('RECTANGLE', 10, 10, 50, 50, frame.id)
    editor.select([a])
    expect(editor.canWrapSelectionInSection()).toBe(false)
    expect(editor.wrapSelectionInSection()).toBeNull()
    expect(editor.graph.getNode(a)?.parentId).toBe(frame.id)
  })
})
