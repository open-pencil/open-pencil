import { describe, test, expect } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { SceneGraph, TextEditor, UndoManager } from '@open-pencil/core'
import type { StyleRun } from '@open-pencil/core'
import { createTextActions } from '@open-pencil/core/editor'
import type { EditorContext, EditorState } from '@open-pencil/core/editor'
import type { FontFallbackScript } from '@open-pencil/core/text'
import { fontManager } from '@open-pencil/core/text'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'
import { repoPath } from '#tests/helpers/paths'

type FallbackTestFontManager = typeof fontManager & {
  cjkFallbackFamilies: Map<FontFallbackScript, string[]>
}

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

  test('commitTextEdit requests script-specific CJK fallback packs', async () => {
    const data = await Bun.file(repoPath('public/Inter-Regular.ttf')).arrayBuffer()
    const manager = fontManager as FallbackTestFontManager
    const originalFallbackFamilies = new Map(manager.cjkFallbackFamilies)
    const originalEnsureFallbackPack = fontManager.ensureFallbackPack.bind(fontManager)
    const requests: FontFallbackScript[][] = []

    try {
      manager.cjkFallbackFamilies = new Map()
      fontManager.markLoaded('Inter', 'Regular', data)
      fontManager.ensureFallbackPack = async (scripts = ['cjk', 'arabic']) => {
        requests.push([...scripts])
        return { 'cjk-sc': ['Manual CJK Fallback'] }
      }

      const { graph, textEditor, textNode, actions } = setup()
      graph.updateNode(textNode.id, { text: '', fontFamily: 'Inter', fontWeight: 400 })

      actions.startTextEditing(textNode.id)
      textEditor.insert('你好世界', getNodeOrThrow(graph, textNode.id))
      actions.commitTextEdit()

      await Promise.resolve()
      expect(requests).toEqual([['cjk-sc']])
    } finally {
      fontManager.ensureFallbackPack = originalEnsureFallbackPack
      manager.cjkFallbackFamilies = originalFallbackFamilies
    }
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

  test('commitTextEdit preserves Figma derived glyphs when text unchanged', () => {
    const { graph, actions, textNode } = setup()
    const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 14 }]
    graph.updateNode(textNode.id, { figmaDerivedTextGlyphs: glyphs })

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).figmaDerivedTextGlyphs).toBe(glyphs)
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
