import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function renameOptions(replacement: string, match = '', startNumber = 1) {
  return { match, replacement, startNumber }
}

describe('selection semantics', () => {
  test('selectInverse selects unselected top-level layers', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('RECTANGLE', pageId, { name: 'Second' })
    const third = editor.graph.createNode('RECTANGLE', pageId, { name: 'Third' })
    editor.select([second.id])

    editor.selectInverse()

    expect(editor.state.selectedIds).toEqual(new Set([first.id, third.id]))
  })

  test('renameSelected applies one name and supports undo', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second' })
    editor.select([first.id, second.id])

    editor.renameSelected(renameOptions('Shared name'))
    expect(editor.graph.getNode(first.id)?.name).toBe('Shared name')
    expect(editor.graph.getNode(second.id)?.name).toBe('Shared name')

    editor.undoAction()
    expect(editor.graph.getNode(first.id)?.name).toBe('First')
    expect(editor.graph.getNode(second.id)?.name).toBe('Second')
  })

  test('renameSelected supports matching, current names, and numbered sequences', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'Icon/Home' })
    const second = editor.graph.createNode('RECTANGLE', pageId, { name: 'Icon/Search' })
    editor.select([first.id, second.id])

    editor.renameSelected(renameOptions('Image/', '^Icon/'))
    expect(editor.graph.getNode(first.id)?.name).toBe('Image/Home')
    expect(editor.graph.getNode(second.id)?.name).toBe('Image/Search')

    editor.renameSelected(renameOptions('$nn $&', '', 7))
    expect(editor.graph.getNode(first.id)?.name).toBe('07 Image/Home')
    expect(editor.graph.getNode(second.id)?.name).toBe('08 Image/Search')

    editor.undoAction()
    editor.renameSelected(renameOptions('$NN $&', '', 7))
    expect(editor.graph.getNode(first.id)?.name).toBe('08 Image/Home')
    expect(editor.graph.getNode(second.id)?.name).toBe('07 Image/Search')
  })

  test('renameSelected rejects invalid regular expressions', () => {
    const editor = createEditor()
    const node = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, { name: 'Home' })
    editor.select([node.id])

    const preview = editor.previewRenameSelected(renameOptions('Icon', '['))
    editor.renameSelected(renameOptions('Icon', '['))

    expect(preview.error).toBe('invalid-pattern')
    expect(editor.graph.getNode(node.id)?.name).toBe('Home')
    expect(editor.undo.canUndo).toBe(false)
  })

  test('blank results restore readable default names', () => {
    const editor = createEditor()
    const componentSet = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
      name: 'Custom'
    })
    editor.select([componentSet.id])

    editor.renameSelected(renameOptions(''))

    expect(editor.graph.getNode(componentSet.id)?.name).toBe('Component set')
  })
})
