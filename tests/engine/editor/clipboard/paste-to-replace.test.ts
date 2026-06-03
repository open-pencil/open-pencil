import { describe, expect, test } from 'bun:test'

import { buildInklyClipboardHTML } from '@inkly/core/clipboard'
import { createEditor } from '@inkly/core/editor'
import type { Editor } from '@inkly/core/editor'

function copiedRectangleHtml(name = 'Pasted') {
  const source = createEditor()
  const sourcePageId = source.state.currentPageId
  const pasted = source.graph.createNode('RECTANGLE', sourcePageId, {
    name,
    x: 0,
    y: 0,
    width: 20,
    height: 20
  })
  return buildInklyClipboardHTML([pasted], source.graph)
}

function copiedFrameHtml() {
  const source = createEditor()
  const sourcePageId = source.state.currentPageId
  const frame = source.graph.createNode('FRAME', sourcePageId, {
    name: 'Pasted frame',
    x: 0,
    y: 0,
    width: 40,
    height: 40
  })
  source.graph.createNode('RECTANGLE', frame.id, {
    name: 'Pasted child',
    x: 5,
    y: 6,
    width: 10,
    height: 12
  })
  return buildInklyClipboardHTML([frame], source.graph)
}

function createTarget(editor: Editor, parentId = editor.state.currentPageId) {
  return editor.graph.createNode('ELLIPSE', parentId, {
    name: 'Target',
    x: 100,
    y: 100,
    width: 40,
    height: 40
  })
}

describe('paste to replace', () => {
  test('replaces selected nodes with pasted Inkly nodes', async () => {
    const html = copiedRectangleHtml()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const target = createTarget(editor)

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })

    expect(editor.graph.getNode(target.id)).toBeUndefined()
    const [createdId] = [...editor.state.selectedIds]
    const created = editor.graph.getNode(createdId)
    expect(created?.name).toBe('Pasted')
    expect(created?.parentId).toBe(pageId)
    expect(created?.x).toBe(110)
    expect(created?.y).toBe(110)
  })

  test('undo and redo preserve replaced and pasted subtrees', async () => {
    const html = copiedRectangleHtml()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const target = createTarget(editor)

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })
    const [createdId] = [...editor.state.selectedIds]

    editor.undo.undo()

    expect(editor.graph.getNode(createdId)).toBeUndefined()
    expect(editor.graph.getNode(target.id)?.parentId).toBe(pageId)
    expect(editor.state.selectedIds).toEqual(new Set([target.id]))

    editor.undo.redo()

    expect(editor.graph.getNode(target.id)).toBeUndefined()
    expect(editor.graph.getNode(createdId)?.parentId).toBe(pageId)
    expect(editor.state.selectedIds).toEqual(new Set([createdId]))
  })

  test('falls back to regular paste when all selected targets are locked', async () => {
    const html = copiedRectangleHtml()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const target = editor.graph.createNode('ELLIPSE', pageId, {
      name: 'Locked target',
      x: 100,
      y: 100,
      width: 40,
      height: 40,
      locked: true
    })

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })

    expect(editor.graph.getNode(target.id)?.parentId).toBe(pageId)
    const [createdId] = [...editor.state.selectedIds]
    expect(createdId).not.toBe(target.id)
    expect(editor.graph.getNode(createdId)?.parentId).toBe(pageId)
  })

  test('replaces only top-level selected targets', async () => {
    const html = copiedRectangleHtml()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const parent = editor.graph.createNode('FRAME', pageId, {
      name: 'Parent target',
      x: 100,
      y: 100,
      width: 80,
      height: 80
    })
    const child = editor.graph.createNode('RECTANGLE', parent.id, {
      name: 'Child target',
      x: 10,
      y: 10,
      width: 20,
      height: 20
    })

    editor.select([parent.id, child.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })

    expect(editor.graph.getNode(parent.id)).toBeUndefined()
    expect(editor.graph.getNode(child.id)).toBeUndefined()
    const [createdId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(createdId)?.parentId).toBe(pageId)
  })

  test('replaces targets inside a frame and preserves parent order through undo and redo', async () => {
    const html = copiedRectangleHtml()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', pageId, {
      name: 'Container',
      x: 50,
      y: 50,
      width: 300,
      height: 300
    })
    const before = editor.graph.createNode('RECTANGLE', frame.id, { name: 'Before', x: 0, y: 0 })
    const target = createTarget(editor, frame.id)
    const after = editor.graph.createNode('RECTANGLE', frame.id, { name: 'After', x: 200, y: 200 })

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })
    const [createdId] = [...editor.state.selectedIds]

    expect(editor.graph.getNode(createdId)?.parentId).toBe(frame.id)
    expect(editor.graph.getNode(frame.id)?.childIds).toEqual([before.id, createdId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(frame.id)?.childIds).toEqual([before.id, target.id, after.id])

    editor.undo.redo()
    expect(editor.graph.getNode(frame.id)?.childIds).toEqual([before.id, createdId, after.id])
  })

  test('preserves pasted child subtrees', async () => {
    const html = copiedFrameHtml()
    const editor = createEditor()
    const target = createTarget(editor)

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })

    const [createdId] = [...editor.state.selectedIds]
    const created = editor.graph.getNode(createdId)
    expect(created?.type).toBe('FRAME')
    expect(created?.childIds).toHaveLength(1)
    const childId = created?.childIds[0]
    expect(childId ? editor.graph.getNode(childId)?.name : undefined).toBe('Pasted child')
  })
})
