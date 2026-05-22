import { describe, expect, test } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { BLACK, TRANSPARENT } from '#core/constants'
import { createEditor } from '#core/editor'
import { fontManager } from '#core/text/fonts'
import { textNodeToOutlineLayout } from '#core/text/outlines'

async function createEditorWithRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  return { editor, surface }
}

async function loadInterRegular() {
  const data = await Bun.file('public/Inter-Regular.ttf').arrayBuffer()
  fontManager.markLoaded('Inter', 'Regular', data)
}

async function loadInterBold() {
  const data = await Bun.file('public/Inter-Bold.ttf').arrayBuffer()
  fontManager.markLoaded('Inter', 'Bold', data)
}

async function loadNotoSansSC() {
  const data = await Bun.file('tests/fixtures/fonts/NotoSansSC-Regular.ttf').arrayBuffer()
  fontManager.markLoaded('Noto Sans SC', 'Regular', data)
  fontManager.setCJKFallbackFamily('Noto Sans SC')
}

describe('flattenSelected', () => {
  test('converts selected shapes into a vector path', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40
    })
    const second = editor.graph.createNode('ELLIPSE', pageId, {
      x: 40,
      y: 30,
      width: 50,
      height: 40
    })

    editor.select([first.id, second.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.x).toBe(10)
    expect(vector?.y).toBe(20)
    expect(vector?.width).toBe(80)
    expect(vector?.height).toBe(50)
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(first.id)).toBeUndefined()
    expect(editor.graph.getNode(second.id)).toBeUndefined()
    surface.delete()
  })

  test('outlines visible strokes into a vector path', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 20,
      y: 30,
      width: 40,
      height: 30,
      fills: [{ type: 'SOLID', color: TRANSPARENT, opacity: 0, visible: true }],
      strokes: [{ type: 'SOLID', color: BLACK, weight: 8, opacity: 1, visible: true }]
    })

    editor.select([rect.id])
    editor.outlineStrokeSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.name).toBe('Outline stroke')
    expect(vector?.x).toBe(16)
    expect(vector?.y).toBe(26)
    expect(vector?.width).toBe(48)
    expect(vector?.height).toBe(38)
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(rect.id)).toBeUndefined()
    surface.delete()
  })

  test('outlines stroked descendants inside groups', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 20,
      y: 30,
      width: 40,
      height: 30,
      fills: [{ type: 'SOLID', color: TRANSPARENT, opacity: 0, visible: true }],
      strokes: [{ type: 'SOLID', color: BLACK, weight: 8, opacity: 1, visible: true }]
    })
    editor.select([rect.id])
    editor.groupSelected()

    editor.outlineStrokeSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.name).toBe('Outline stroke')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    surface.delete()
  })

  test('does not outline fill-only shapes as strokes', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 20,
      y: 30,
      width: 40,
      height: 30,
      strokes: []
    })

    editor.select([rect.id])
    const result = editor.outlineStrokeSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(rect.id)?.type).toBe('RECTANGLE')
    surface.delete()
  })

  test('outlines loaded text through the shared text outline path', async () => {
    await loadInterRegular()
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40
    })

    editor.select([text.id])
    editor.outlineTextSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.name).toBe('Outline text')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(text.id)).toBeUndefined()
    surface.delete()
  })

  test('flattens loaded text as outlines', async () => {
    await loadInterRegular()
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(text.id)).toBeUndefined()
    surface.delete()
  })

  test('wraps loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hello world',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 100,
      height: 100,
      styleRuns: [{ start: 6, length: 5, style: { fontWeight: 700 } }]
    })

    const layout = textNodeToOutlineLayout(text)

    expect(layout).not.toBeNull()
    expect(layout?.height).toBeGreaterThan(40)
  })

  test('flattens loaded text style runs as outlines', async () => {
    await loadInterRegular()
    await loadInterBold()
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 80,
      height: 40,
      styleRuns: [{ start: 1, length: 1, style: { fontWeight: 700, fontSize: 40 } }]
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    surface.delete()
  })

  test('flattens mixed Latin and CJK text with loaded fallback outlines', async () => {
    await loadInterRegular()
    await loadNotoSansSC()
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Hi你',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    surface.delete()
  })

  test('does not flatten complex script text without shaping support', async () => {
    await loadInterRegular()
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'مرحبا',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 32,
      width: 120,
      height: 40
    })

    editor.select([text.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(text.id)?.type).toBe('TEXT')
    surface.delete()
  })

  test('does not flatten unsupported text nodes', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const text = editor.graph.createNode('TEXT', pageId, {
      text: 'Nope',
      fontFamily: 'Definitely Missing Font'
    })
    const rect = editor.graph.createNode('RECTANGLE', pageId)

    editor.select([text.id, rect.id])
    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([text.id, rect.id])
    expect(editor.state.selectedIds).toEqual(new Set([text.id, rect.id]))
    surface.delete()
  })

  test('does not flatten containers with unsupported descendants', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId)
    const image = editor.graph.createNode('RECTANGLE', pageId, {
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
    editor.select([rect.id, image.id])
    editor.groupSelected()
    const [groupId] = [...editor.state.selectedIds]

    const result = editor.flattenSelected()

    expect(result).toBeNull()
    expect(editor.graph.getNode(groupId)?.type).toBe('GROUP')
    surface.delete()
  })

  test('flattens visual descendants from groups', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40
    })
    const ellipse = editor.graph.createNode('ELLIPSE', pageId, {
      x: 70,
      y: 20,
      width: 30,
      height: 30
    })
    editor.select([rect.id, ellipse.id])
    editor.groupSelected()
    const [groupId] = [...editor.state.selectedIds]

    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(groupId)).toBeUndefined()
    surface.delete()
  })

  test('includes stroke-only rectangles as flattenable outlines', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      x: 10,
      y: 20,
      width: 50,
      height: 40,
      fills: [],
      strokes: [
        { type: 'SOLID', color: BLACK, opacity: 1, visible: true, weight: 8, align: 'CENTER' }
      ]
    })

    editor.select([rect.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.width).toBeGreaterThan(50)
    expect(vector?.height).toBeGreaterThan(40)
    surface.delete()
  })

  test('undo and redo restore flattened children and vector', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second', x: 50 })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })

    editor.select([first.id, second.id])
    editor.flattenSelected()
    const [vectorId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([
      before.id,
      first.id,
      second.id,
      after.id
    ])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])
    expect(editor.graph.getNode(vectorId)?.type).toBe('VECTOR')
    surface.delete()
  })
})
