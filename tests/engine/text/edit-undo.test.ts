import { describe, test, expect } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { SceneGraph, TextEditor, UndoManager } from '@open-pencil/core'
import type { DerivedTextGlyph, StyleRun } from '@open-pencil/core'
import { createTextActions } from '@open-pencil/core/editor'
import type { EditorContext, EditorState } from '@open-pencil/core/editor'

import { fontManager } from '#core/text/fonts'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

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
    runLayoutForNode: () => undefined,
    getCk: () => null,
    loadFont: async () => undefined,
    getViewportSize: () => ({ width: 800, height: 600 }),
    subscribeToGraph: () => undefined
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

function straightTextPathNetwork() {
  return {
    vertices: [
      { x: 0, y: 20 },
      { x: 200, y: 20 }
    ],
    segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
    regions: []
  }
}

async function setupPathText() {
  const font = await fontManager.fetchBundledFont('/Inter-Regular.ttf')
  expect(font).toBeTruthy()
  if (!font) return null
  fontManager.markLoaded('Inter', 'Regular', font)

  const setupResult = setup()
  const glyphs: DerivedTextGlyph[] = [
    { commandsBlob: new Uint8Array([0]), x: 20, y: 20, fontSize: 20, rotation: 0 },
    { commandsBlob: new Uint8Array([0]), x: 40, y: 20, fontSize: 20, rotation: 0 }
  ]
  setupResult.graph.updateNode(setupResult.textNode.id, {
    text: 'AB',
    fontFamily: 'Inter',
    fontSize: 20,
    width: 200,
    height: 40,
    textPathData: {
      network: straightTextPathNetwork(),
      normalizedSize: { x: 200, y: 40 },
      tValue: 0,
      forward: true
    },
    textPathBox: { x: 0, y: 0, width: 200, height: 40 },
    derivedTextGlyphs: glyphs
  })
  return setupResult
}

function paragraphWithHeight(height: number) {
  return {
    getHeight: () => height,
    getLongestLine: () => 0,
    delete: () => undefined
  }
}

function deletableParagraphWithHeight(height: number) {
  let deleted = false
  return {
    getHeight: () => {
      if (deleted) throw new Error('paragraph was deleted')
      return height
    },
    getLongestLine: () => {
      if (deleted) throw new Error('paragraph was deleted')
      return 0
    },
    delete: () => {
      deleted = true
    }
  }
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

  test('reflows live path-text edits and restores glyphs through undo and redo', async () => {
    const setupResult = await setupPathText()
    if (!setupResult) return
    const { graph, undo, textEditor, textNode, actions } = setupResult
    const originalGlyphs = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    )

    actions.startTextEditing(textNode.id)
    textEditor.insert('C', getNodeOrThrow(graph, textNode.id))
    actions.updateTextEditNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    const liveGlyphs = expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    expect(liveGlyphs).toHaveLength(3)
    expect(liveGlyphs).not.toEqual(originalGlyphs)

    actions.commitTextEdit()
    const committedGlyphs = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs)
    )
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('AB')
    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toEqual(originalGlyphs)

    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('ABC')
    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toEqual(committedGlyphs)
  })

  test('restores path identity when undoing an edit to empty text', async () => {
    const setupResult = await setupPathText()
    if (!setupResult) return
    const { graph, undo, textEditor, textNode, actions } = setupResult
    const originalPathData = structuredClone(
      expectDefined(getNodeOrThrow(graph, textNode.id).textPathData)
    )

    actions.startTextEditing(textNode.id)
    textEditor.selectAll()
    textEditor.backspace(getNodeOrThrow(graph, textNode.id))
    actions.updateTextEditNode(textNode.id, { text: '' })
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).textPathData).toBeNull()
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('AB')
    expect(getNodeOrThrow(graph, textNode.id).textPathData).toEqual(originalPathData)
    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).text).toBe('')
    expect(getNodeOrThrow(graph, textNode.id).textPathData).toBeNull()
  })

  test('keeps an empty text override inside an instance through sync and undo', () => {
    const { graph, undo, textEditor, actions } = setup()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, {
      width: 100,
      height: 20
    })
    graph.createNode('TEXT', component.id, {
      text: 'Confidential',
      width: 100,
      height: 20
    })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const instanceText = getNodeOrThrow(graph, instance.childIds[0])

    actions.startTextEditing(instanceText.id)
    textEditor.selectAll()
    textEditor.backspace(instanceText)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')
    expect(getNodeOrThrow(graph, instance.id).overrides[`${instanceText.id}:text`]).toBe('')
    graph.syncInstances(component.id)
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')

    undo.undo()
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('Confidential')
    expect(`${instanceText.id}:text` in getNodeOrThrow(graph, instance.id).overrides).toBe(false)

    undo.redo()
    graph.syncInstances(component.id)
    expect(getNodeOrThrow(graph, instanceText.id).text).toBe('')
  })

  test('does not create a text override for a style-only instance edit', () => {
    const { graph, textEditor, actions } = setup()
    const page = graph.getPages()[0]
    const component = graph.createNode('COMPONENT', page.id, { width: 100, height: 20 })
    graph.createNode('TEXT', component.id, { text: 'Label', width: 100, height: 20 })
    const instance = expectDefined(graph.createInstance(component.id, page.id), 'instance')
    const instanceText = getNodeOrThrow(graph, instance.childIds[0])

    actions.startTextEditing(instanceText.id)
    const state = expectDefined(textEditor.state, 'text editor state')
    graph.updateNode(instanceText.id, {
      styleRuns: [{ start: 0, length: state.text.length, style: { fontWeight: 700 } }]
    })
    actions.commitTextEdit()

    expect(`${instanceText.id}:text` in getNodeOrThrow(graph, instance.id).overrides).toBe(false)
  })

  test('commitTextEdit preserves auto-height text bounds', () => {
    const { graph, undo, textEditor, textNode, actions } = setup()
    graph.updateNode(textNode.id, { textAutoResize: 'HEIGHT', height: 18 })

    actions.startTextEditing(textNode.id)
    const state = expectDefined(textEditor.state, 'text editor state')
    state.paragraph = paragraphWithHeight(42) as NonNullable<typeof state.paragraph>
    textEditor.insert(' World', getNodeOrThrow(graph, textNode.id))

    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).height).toBe(42)
    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).height).toBe(18)
    undo.redo()
    expect(getNodeOrThrow(graph, textNode.id).height).toBe(42)
  })

  test('commitTextEdit measures auto-size before deleting the edit paragraph', () => {
    const { graph, textEditor, textNode, actions } = setup()
    graph.updateNode(textNode.id, { textAutoResize: 'HEIGHT', height: 18 })

    actions.startTextEditing(textNode.id)
    const state = expectDefined(textEditor.state, 'text editor state')
    state.paragraph = deletableParagraphWithHeight(42) as NonNullable<typeof state.paragraph>
    textEditor.insert(' World', getNodeOrThrow(graph, textNode.id))

    expect(() => actions.commitTextEdit()).not.toThrow()
    expect(getNodeOrThrow(graph, textNode.id).height).toBe(42)
  })

  test('commitTextEdit does not push undo when text unchanged', () => {
    const { undo, actions, textNode } = setup()

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(undo.canUndo).toBe(false)
  })

  test('commitTextEdit preserves derived glyphs when text unchanged', () => {
    const { graph, actions, textNode } = setup()
    const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 14 }]
    graph.updateNode(textNode.id, { derivedTextGlyphs: glyphs })

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toBe(glyphs)
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
