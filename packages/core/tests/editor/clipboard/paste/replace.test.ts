import { describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

function copiedRectangleHTML(name = 'Pasted') {
  const source = createEditor()
  const sourcePageId = source.state.currentPageId
  const pasted = source.graph.createNode('RECTANGLE', sourcePageId, {
    name,
    x: 0,
    y: 0,
    width: 20,
    height: 20
  })
  return buildOpenPencilClipboardHTML([pasted], source.graph)
}

function copiedFrameHTML() {
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
  return buildOpenPencilClipboardHTML([frame], source.graph)
}

function canvasBox(editor: Editor, id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error(`Missing layer ${id}`)
  const box = getAxisAlignedWorldBounds(node, editor.graph)
  return { x: Math.round(box.x), y: Math.round(box.y) }
}

/** The layer's x and y axes on the canvas, rounded: `[1, 0, 0, 1]` when drawn upright. */
function canvasAxes(editor: Editor, id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error(`Missing layer ${id}`)
  const [a, c, , b, d] = getWorldMatrix(node, editor.graph)
  return [a, b, c, d].map((value) => Math.round(value) + 0)
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
  test('replaces selected nodes with pasted OpenPencil nodes', async () => {
    const html = copiedRectangleHTML()
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
    expect(created?.x).toBe(100)
    expect(created?.y).toBe(100)
  })

  test('undo and redo preserve replaced and pasted subtrees', async () => {
    const html = copiedRectangleHTML()
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
    const html = copiedRectangleHTML()
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
    const html = copiedRectangleHTML()
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
    const html = copiedRectangleHTML()
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

  test('starts the replacement where the target started on the canvas, upright, inside an offset, rotated, or flipped frame', async () => {
    const html = copiedRectangleHTML()
    const editor = createEditor()
    const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
      x: 50,
      y: 50,
      width: 300,
      height: 300
    })
    const target = createTarget(editor, frame.id)
    for (const transform of [
      {},
      { rotation: 90 },
      { rotation: 30 },
      { rotation: 0, flipY: true }
    ]) {
      editor.graph.updateNode(frame.id, transform)
      const start = canvasBox(editor, target.id)
      editor.select([target.id])
      await editor.pasteFromHTML(html, undefined, { replaceSelection: true })
      const [createdId] = editor.state.selectedIds
      // Figma keeps the target's canvas top-left, and the replacement as it was drawn when copied
      // (desktop 126).
      expect(editor.graph.getNode(createdId)?.parentId).toBe(frame.id)
      expect(canvasBox(editor, createdId)).toMatchObject({ x: start.x, y: start.y })
      expect(canvasAxes(editor, createdId)).toEqual([1, 0, 0, 1])
      editor.undo.undo()
    }
  })

  test('an instance replacing a layer inside its own component stays out of it', async () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const card = editor.graph.createNode('COMPONENT', page, {
      name: 'Card',
      width: 200,
      height: 200
    })
    const inner = editor.graph.createNode('FRAME', card.id, {
      name: 'Inner',
      width: 100,
      height: 100
    })
    const target = createTarget(editor, inner.id)
    const instance = editor.graph.createInstance(card.id, page, { x: 400 })
    if (!instance) throw new Error('Expected an instance')
    editor.select([instance.id])
    const { snapshot } = await editor.prepareCopy()
    if (!snapshot) throw new Error('Missing snapshot')

    editor.select([target.id])
    await editor.pasteSnapshot(snapshot, undefined, { replaceSelection: true })
    const created = editor.graph.getNode([...editor.state.selectedIds][0])
    expect(created).toMatchObject({ type: 'INSTANCE', componentId: card.id, parentId: page })
    expect(inner.childIds).toEqual([])

    editor.undo.undo()
    editor.undo.redo()
    expect(editor.graph.getNode(created?.id ?? '')?.parentId).toBe(page)
    expect(inner.childIds).toEqual([])
  })

  test('preserves pasted child subtrees', async () => {
    const html = copiedFrameHTML()
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
