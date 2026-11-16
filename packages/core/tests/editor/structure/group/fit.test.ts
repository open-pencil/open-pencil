import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

let editor: Editor

afterEach(() => editor.dispose())

/** A group of two 40×40 rectangles, at x 0 and 100, on the page or in `parentId`. */
function setup(parentId?: string) {
  const page = editor.state.currentPageId
  const target = parentId ?? page
  const left = editor.graph.createNode('RECTANGLE', target, { x: 0, y: 0, width: 40, height: 40 })
  const right = editor.graph.createNode('RECTANGLE', target, {
    x: 100,
    y: 0,
    width: 40,
    height: 40
  })
  editor.select([left.id, right.id])
  editor.groupSelected()
  const groupId = editor.graph.getNode(left.id)?.parentId
  if (!groupId || groupId === target) throw new Error('expected a group')
  return { page, groupId, left: left.id, right: right.id }
}

function box(id: string) {
  const node = editor.graph.getNode(id)
  if (!node) return null
  return { x: node.x, y: node.y, width: node.width, height: node.height }
}

function worldX(id: string) {
  return editor.graph.getAbsolutePosition(id).x
}

describe('groups fit their layers after layer edits', () => {
  test('a delete shrinks the group around the layers left, and undo and redo follow', () => {
    editor = createEditor()
    const { groupId, left, right } = setup()

    editor.select([left])
    editor.deleteSelected()
    expect(box(groupId)).toEqual({ x: 100, y: 0, width: 40, height: 40 })
    expect(worldX(right)).toBe(100)

    editor.undo.undo()
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 140, height: 40 })
    expect(worldX(left)).toBe(0)
    expect(worldX(right)).toBe(100)

    editor.undo.redo()
    expect(box(groupId)).toEqual({ x: 100, y: 0, width: 40, height: 40 })
    expect(worldX(right)).toBe(100)
  })

  test('deleting every layer of a group removes it, and one undo brings both back', () => {
    editor = createEditor()
    const { page, groupId, left, right } = setup()

    editor.select([left, right])
    editor.deleteSelected()
    expect(box(groupId)).toBeNull()
    expect(editor.graph.getNode(page)?.childIds).toEqual([])

    editor.undo.undo()
    expect(editor.graph.getNode(groupId)?.childIds).toEqual([left, right])
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 140, height: 40 })
  })

  test('moving a layer to another page shrinks the group it left', () => {
    editor = createEditor()
    const { groupId, left, right } = setup()
    const other = editor.addPage('Other')

    editor.select([right])
    editor.moveToPage(other)
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 40, height: 40 })

    editor.undo.undo()
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 140, height: 40 })
    expect(worldX(left)).toBe(0)
    expect(worldX(right)).toBe(100)
  })

  test('dragging a layer in the layers panel fits the group it left and the one it joined', () => {
    editor = createEditor()
    const { page, groupId, left, right } = setup()
    const outside = editor.graph.createNode('RECTANGLE', page, {
      x: 300,
      y: 0,
      width: 40,
      height: 40
    })

    editor.reorderChildWithUndo(right, page, 0)
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 40, height: 40 })

    editor.reorderChildWithUndo(outside.id, groupId, 0)
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 340, height: 40 })
    expect(worldX(outside.id)).toBe(300)

    editor.undo.undo()
    editor.undo.undo()
    expect(box(groupId)).toEqual({ x: 0, y: 0, width: 140, height: 40 })
    expect(worldX(left)).toBe(0)
    expect(worldX(right)).toBe(100)
  })

  test('a hugging auto layout around a group makes room when the group shrinks', () => {
    editor = createEditor()
    const row = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    const { groupId, left } = setup(row.id)
    const tail = editor.graph.createNode('RECTANGLE', row.id, { width: 10, height: 10 })
    editor.runLayoutForNode(row.id)
    expect(box(row.id)?.width).toBe(150)

    editor.select([left])
    editor.deleteSelected()
    expect(box(groupId)?.width).toBe(40)
    expect(box(row.id)?.width).toBe(50)
    expect(box(tail.id)?.x).toBe(40)

    editor.undo.undo()
    expect(box(groupId)?.width).toBe(140)
    expect(box(row.id)?.width).toBe(150)
    expect(box(tail.id)?.x).toBe(140)
  })
})
