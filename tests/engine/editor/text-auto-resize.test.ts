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
