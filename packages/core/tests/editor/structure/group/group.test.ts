import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

// Recorded in Figma desktop 126 with ⌘G and ⌥⌘G (scratch/pr-oracle/grouping).

function setup() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const rect = (parentId: string, name: string, x = 0, y = 0) =>
    editor.graph.createNode('RECTANGLE', parentId, { name, x, y, width: 40, height: 30 })
  const names = (parentId: string) => editor.graph.getChildren(parentId).map((child) => child.name)
  const selected = () => [...editor.state.selectedIds].map((id) => editor.graph.getNode(id))
  return { editor, pageId, rect, names, selected }
}

describe('groupSelected', () => {
  test('wraps a single layer in a group in its place', () => {
    const { editor, pageId, rect, names, selected } = setup()
    const a = rect(pageId, 'A', 10, 10)
    rect(pageId, 'B', 100, 10)

    editor.select([a.id])
    editor.groupSelected()

    expect(names(pageId)).toEqual(['Group 1', 'B'])
    const [group] = selected()
    expect(group?.type).toBe('GROUP')
    expect([group?.x, group?.y, group?.width, group?.height]).toEqual([10, 10, 40, 30])
    expect(editor.graph.getAbsolutePosition(a.id)).toEqual({ x: 10, y: 10 })
  })

  test('makes one group per parent, as one undo step that restores the selection', () => {
    const { editor, pageId, rect, names, selected } = setup()
    const frame = editor.graph.createNode('FRAME', pageId, { name: 'F', width: 300, height: 200 })
    const a = rect(frame.id, 'A', 10, 10)
    const b = rect(pageId, 'B', 700, 0)

    editor.select([a.id, b.id])
    editor.groupSelected()

    expect(names(frame.id)).toEqual(['Group 1'])
    expect(names(pageId)).toEqual(['F', 'Group 1'])
    expect(selected().map((node) => node?.type)).toEqual(['GROUP', 'GROUP'])

    editor.undoAction()
    expect(names(frame.id)).toEqual(['A'])
    expect(names(pageId)).toEqual(['F', 'B'])
    expect(editor.state.selectedIds).toEqual(new Set([a.id, b.id]))
  })

  test('takes a layer inside another selected layer along with it', () => {
    const { editor, pageId, rect, names } = setup()
    const frame = editor.graph.createNode('FRAME', pageId, { name: 'F', width: 200, height: 150 })
    const a = rect(frame.id, 'A')

    editor.select([frame.id, a.id])
    editor.groupSelected()

    expect(names(pageId)).toEqual(['Group 1'])
    expect(names(editor.graph.getChildren(pageId)[0]?.id ?? '')).toEqual(['F'])
    expect(names(frame.id)).toEqual(['A'])
  })
})

describe('groupSelected in an auto layout', () => {
  test('places the group among the layers left beside it', () => {
    const { editor, pageId, rect, names } = setup()
    const row = editor.graph.createNode('FRAME', pageId, { name: 'Row', width: 400, height: 100 })
    editor.graph.updateNode(row.id, { layoutMode: 'HORIZONTAL', itemSpacing: 10 })
    const a = rect(row.id, 'A')
    rect(row.id, 'B')
    const c = rect(row.id, 'C')
    rect(row.id, 'D')
    editor.select([a.id, c.id])

    editor.groupSelected()

    // The group takes C's place and spans A and C as they were; B and D flow around it.
    expect(names(row.id)).toEqual(['B', 'Group 1', 'D'])
    const [b, group, d] = editor.graph.getChildren(row.id)
    expect(group?.x).toBe((b?.x ?? 0) + (b?.width ?? 0) + 10)
    expect(d?.x).toBe((group?.x ?? 0) + (group?.width ?? 0) + 10)
  })
})

describe('frameSelection', () => {
  test('makes one frame per parent', () => {
    const { editor, pageId, rect, names, selected } = setup()
    const host = editor.graph.createNode('FRAME', pageId, { name: 'Host', width: 300, height: 200 })
    const a = rect(host.id, 'A', 10, 10)
    const b = rect(pageId, 'B', 700, 0)

    editor.select([a.id, b.id])
    editor.frameSelection()

    expect(names(host.id)).toEqual(['Frame 1'])
    expect(names(pageId)).toEqual(['Host', 'Frame 1'])
    expect(selected().map((node) => node?.type)).toEqual(['FRAME', 'FRAME'])
    expect(editor.graph.getAbsolutePosition(b.id)).toEqual({ x: 700, y: 0 })
  })
})
