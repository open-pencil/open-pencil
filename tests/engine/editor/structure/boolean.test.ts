import { describe, expect, test } from 'bun:test'

import { TRANSPARENT } from '@open-pencil/core/constants'
import { createEditor } from '@open-pencil/core/editor'

describe('booleanOperationSelected', () => {
  test('wraps selected nodes in a boolean operation container', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 30,
      height: 40
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      x: 80,
      y: 90,
      width: 20,
      height: 10
    })

    editor.select([first.id, second.id])
    editor.booleanOperationSelected('UNION')

    const [booleanId] = [...editor.state.selectedIds]
    const booleanNode = editor.graph.getNode(booleanId)
    expect(booleanNode?.type).toBe('BOOLEAN_OPERATION')
    expect(booleanNode?.booleanOperation).toBe('UNION')
    expect(booleanNode?.fills).toEqual(first.fills)
    expect(booleanNode?.childIds).toEqual([first.id, second.id])
    expect(editor.graph.getNode(first.id)?.parentId).toBe(booleanId)
    expect(editor.graph.getNode(second.id)?.parentId).toBe(booleanId)
  })

  test('does not wrap unsupported text nodes', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('TEXT', pageId, {
      text: 'Nope',
      fontFamily: 'Definitely Missing Font'
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))
  })

  test('does not wrap complex script text without shaping support', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: 'Inter'
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
  })

  test('does not wrap visible image fills', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      fills: [
        {
          type: 'IMAGE',
          imageHash: 'image',
          imageScaleMode: 'FILL',
          color: TRANSPARENT,
          opacity: 1,
          visible: true
        }
      ]
    })
    const second = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([first.id, second.id])
    const result = editor.booleanOperationSelected('UNION')

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([first.id, second.id])
  })

  test('undo and redo preserve parent order and selection', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second' })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })

    editor.select([first.id, second.id])
    editor.booleanOperationSelected('EXCLUDE')
    const [booleanId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, booleanId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([
      before.id,
      first.id,
      second.id,
      after.id
    ])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, booleanId, after.id])
    expect(editor.graph.getNode(booleanId)?.booleanOperation).toBe('EXCLUDE')
    expect(editor.state.selectedIds).toEqual(new Set([booleanId]))
  })
})
