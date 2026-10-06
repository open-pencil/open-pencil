import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setupEditor() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const nodes = ['A', 'B', 'C', 'D'].map((name) =>
    editor.graph.createNode('RECTANGLE', pageId, { name, width: 10, height: 10 })
  )
  return { editor, pageId, nodes }
}

function childNames(editor: ReturnType<typeof createEditor>, pageId: string) {
  return editor.graph.getChildren(pageId).map((node) => node.name)
}

describe('z-order actions', () => {
  test('moves a contiguous selection forward and backward by one layer', () => {
    const { editor, pageId, nodes } = setupEditor()
    editor.select([nodes[1]?.id ?? '', nodes[2]?.id ?? ''])

    editor.bringForward()
    expect(childNames(editor, pageId)).toEqual(['A', 'D', 'B', 'C'])

    editor.sendBackward()
    expect(childNames(editor, pageId)).toEqual(['A', 'B', 'C', 'D'])
  })

  test('preserves selected relative order when moving to front or back', () => {
    const { editor, pageId, nodes } = setupEditor()
    editor.select([nodes[0]?.id ?? '', nodes[2]?.id ?? ''])

    editor.bringToFront()
    expect(childNames(editor, pageId)).toEqual(['B', 'D', 'A', 'C'])

    editor.sendToBack()
    expect(childNames(editor, pageId)).toEqual(['A', 'C', 'B', 'D'])
  })

  test('records z-order changes in undo history', () => {
    const { editor, pageId, nodes } = setupEditor()
    editor.select([nodes[1]?.id ?? ''])

    editor.bringForward()
    expect(childNames(editor, pageId)).toEqual(['A', 'C', 'B', 'D'])

    editor.undoAction()
    expect(childNames(editor, pageId)).toEqual(['A', 'B', 'C', 'D'])

    editor.redoAction()
    expect(childNames(editor, pageId)).toEqual(['A', 'C', 'B', 'D'])
  })

  test('grouping takes the topmost layer’s place, and ungrouping and undo keep the stack', () => {
    // Recorded in Figma desktop 126: grouping A and C of A, B, C, D gives B, Group, D.
    const { editor, pageId, nodes } = setupEditor()
    editor.select([nodes[2]?.id ?? '', nodes[0]?.id ?? ''])

    editor.groupSelected()
    expect(childNames(editor, pageId)).toEqual(['B', 'Group', 'D'])
    const [groupId] = [...editor.state.selectedIds]
    expect(editor.graph.getChildren(groupId ?? '').map((node) => node.name)).toEqual(['A', 'C'])

    editor.undoAction()
    expect(childNames(editor, pageId)).toEqual(['A', 'B', 'C', 'D'])

    editor.redoAction()
    expect(childNames(editor, pageId)).toEqual(['B', 'Group', 'D'])
    editor.ungroupSelected()
    expect(childNames(editor, pageId)).toEqual(['B', 'A', 'C', 'D'])

    editor.undoAction()
    expect(childNames(editor, pageId)).toEqual(['B', 'Group', 'D'])
  })
})
