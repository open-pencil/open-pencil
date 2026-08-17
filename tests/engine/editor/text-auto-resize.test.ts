import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { setTextMeasurer } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'

afterEach(() => {
  setTextMeasurer(null)
})

describe('editor text auto-resize updates', () => {
  test('lineHeight changes resize auto-height text', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNode(text.id, { lineHeight: 48 })

    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('lineHeight changes on auto-height text are undoable with height', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNodeWithUndo(text.id, { lineHeight: 48 }, 'Change lineHeight')

    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(20)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(20)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('direct edits drop stale path glyphs without paragraph auto-resize', () => {
    // A mutation outside the font-gated canvas edit session cannot reflow the
    // glyphs. It must clear stale outlines/path identity without applying
    // paragraph auto-resize to the imported path-text box.
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const glyphs = [
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 0, y: 0, fontSize: 80 },
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 40, y: 5, fontSize: 80 }
    ]
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ab',
      textAutoResize: 'HEIGHT',
      width: 200,
      height: 200,
      fontFamily: 'NoSuchFont',
      fontSize: 80,
      textPathData: {
        network: {
          vertices: [
            { x: 0, y: 100 },
            { x: 200, y: 100 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        normalizedSize: { x: 200, y: 200 },
        tValue: 0,
        forward: true
      },
      textPathBox: { x: 0, y: 0, width: 200, height: 200 },
      derivedTextGlyphs: glyphs
    })

    editor.updateNode(text.id, { text: 'abc' })

    const updated = getNodeOrThrow(editor.graph, text.id)
    expect(updated.derivedTextGlyphs).toBeNull()
    expect(updated.textPathData).toBeNull()
    expect(updated.height).toBe(200)
  })

  test('font size changes resize width-and-height text', () => {
    setTextMeasurer((node) => ({ width: node.fontSize * 4, height: node.fontSize * 2 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Text',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 40,
      height: 20,
      fontSize: 10
    })

    editor.updateNode(text.id, { fontSize: 16 })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(64)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(32)
  })
})
