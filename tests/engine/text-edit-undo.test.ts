import { describe, test, expect } from 'bun:test'

import { SceneGraph, TextEditor, UndoManager } from '@open-pencil/core'
import { createTextActions } from '@open-pencil/core/editor'

import { expectDefined, getNodeOrThrow } from '../helpers/assert'

import type { StyleRun } from '@open-pencil/core'
import type { EditorContext, EditorState } from '@open-pencil/core/editor'
import type { CanvasKit } from 'canvaskit-wasm'

function setup() {
  const graph = new SceneGraph()
  const pageId = graph.getPages()[0].id
  const undo = new UndoManager()
  const textEditor = new TextEditor({} as CanvasKit)

  const state = {
    editingTextId: null,
    currentPageId: pageId,
    renderVersion: 0,
    sceneVersion: 0
  } as EditorState

  const ctx: EditorContext = {
    graph,
    undo,
    state,
    requestRender: () => {
      state.renderVersion++
      state.sceneVersion++
    },
    requestRepaint: () => {
      state.renderVersion++
    },
    getTextEditor: () => textEditor,
    getRenderer: () => null,
    runLayoutForNode: () => {},
    getCk: () => null,
    loadFont: async () => {},
    getViewportSize: () => ({ width: 800, height: 600 }),
    subscribeToGraph: () => {}
  }

  const textNode = graph.createNode('TEXT', pageId, {
    name: 'Label',
    text: 'Hello',
    width: 100,
    height: 20
  })

  const actions = createTextActions(ctx)
  return { graph, undo, textEditor, state, textNode, actions }
}

describe('text edit undo', () => {
  test('commitTextEdit pushes undo entry when text changed', () => {
    const { graph, undo, textEditor, textNode, actions } = setup()

    actions.startTextEditing(textNode.id)
    expect(textEditor.isActive).toBe(true)

    textEditor.insert(' World', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    actions.commitTextEdit()

    expect(undo.canUndo).toBe(true)
    expect(undo.undoLabel).toBe('Edit text')
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello World')

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello')

    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello World')
  })

  test('commitTextEdit does not push undo when text unchanged', () => {
    const { undo, actions, textNode } = setup()

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(undo.canUndo).toBe(false)
  })

  test('undo restores original text even when graph was synced mid-edit', () => {
    const { graph, undo, textEditor, textNode, actions } = setup()

    actions.startTextEditing(textNode.id)

    textEditor.insert(' Beautiful', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    textEditor.insert(' World', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello Beautiful World')
    expect(undo.canUndo).toBe(true)

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello')
  })

  test('sequential edits create separate undo entries', () => {
    const { graph, undo, textEditor, textNode, actions } = setup()

    actions.startTextEditing(textNode.id)
    textEditor.insert('!', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })
    actions.commitTextEdit()

    actions.startTextEditing(textNode.id)
    textEditor.insert('!', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello!!')

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello!')

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello')
  })

  test('undo restores styleRuns when they changed during editing', () => {
    const { graph, undo, textEditor, textNode, actions } = setup()

    const boldRun: StyleRun = { start: 0, length: 5, style: { fontWeight: 700 } }
    graph.updateNode(textNode.id, { styleRuns: [boldRun] })

    actions.startTextEditing(textNode.id)

    textEditor.insert(' World', textNode)
    const newRuns: StyleRun[] = [
      { start: 0, length: 5, style: { fontWeight: 700 } },
      { start: 5, length: 6, style: { fontWeight: 400 } }
    ]
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text,
      styleRuns: newRuns
    })

    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).styleRuns).toEqual(newRuns)
    expect(undo.canUndo).toBe(true)

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello')
    expect(getNodeOrThrow(graph, textNode.id).styleRuns).toEqual([boldRun])

    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('Hello World')
    expect(getNodeOrThrow(graph, textNode.id).styleRuns).toEqual(newRuns)
  })

  test('undo entry is pushed when only styleRuns changed', () => {
    const { graph, undo, textNode, actions } = setup()

    actions.startTextEditing(textNode.id)

    const newRuns: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    graph.updateNode(textNode.id, { styleRuns: newRuns })

    actions.commitTextEdit()

    expect(undo.canUndo).toBe(true)

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).styleRuns).toEqual([])
  })

  test('no undo entry when neither text nor styleRuns changed', () => {
    const { undo, actions, textNode } = setup()

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(undo.canUndo).toBe(false)
  })
})
