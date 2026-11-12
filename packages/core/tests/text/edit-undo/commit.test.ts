import { describe, test, expect } from 'bun:test'

import { setupTextEdit } from '#core-tests/helpers/text-edit'

import type { StyleRun } from '@open-pencil/scene-graph'
import { expectDefined, getNodeOrThrow } from '@open-pencil/test-support/assert'

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
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()

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

  test('ends the edit when an undo takes the text away, and leaves its redo in place', () => {
    const { graph, undo, textEditor, state, textNode, actions } = setupTextEdit()
    const pageId = state.currentPageId
    const snapshot = structuredClone(textNode)
    // The step that made the text, as a duplicate or a paste records one.
    undo.push({
      label: 'Duplicate',
      forward: () => graph.createNodeWithId(snapshot.id, 'TEXT', pageId, snapshot),
      inverse: () => graph.deleteNode(snapshot.id)
    })
    actions.startTextEditing(textNode.id)

    actions.runTextEditStep(() => undo.undo())
    expect(graph.getNode(textNode.id)).toBeUndefined()
    expect(textEditor.isActive).toBe(false)
    expect(state.editingTextId).toBeNull()

    actions.runTextEditStep(() => undo.redo())
    expect(graph.getNode(textNode.id)).toBeDefined()
    expect(undo.canUndo).toBe(true)
    expect(undo.undoLabel).toBe('Duplicate')
  })

  test('undoes a change made while editing on its own, then the typing before it', () => {
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()
    const listed = [{ listType: 'ORDERED' as const, indentation: 1 }]
    const read = () => getNodeOrThrow(graph, textNode.id)
    actions.startTextEditing(textNode.id)
    textEditor.insert(' World', textNode)
    graph.updateNode(textNode.id, {
      text: expectDefined(textEditor.state, 'text editor state').text
    })

    // A list shortcut while editing, recorded the way updateNodeWithUndo records it.
    actions.runTextEditStep(() => {
      graph.updateNode(textNode.id, { textParagraphs: listed })
      undo.push({
        label: 'Change list style',
        forward: () => graph.updateNode(textNode.id, { textParagraphs: listed }),
        inverse: () => graph.updateNode(textNode.id, { textParagraphs: [] })
      })
    })
    expect(undo.undoLabel).toBe('Change list style')

    actions.runTextEditStep(() => undo.undo())
    expect(read().textParagraphs).toEqual([])
    expect(read().text).toBe('Hello World')
    expect(textEditor.isActive).toBe(true)

    actions.runTextEditStep(() => undo.undo())
    expect(read().text).toBe('Hello')
    expect(textEditor.state?.text).toBe('Hello')

    // Nothing changed since the last undo, so leaving the edit records nothing more.
    actions.commitTextEdit()
    expect(undo.canUndo).toBe(false)
    expect(undo.canRedo).toBe(true)
  })
  test('commitTextEdit preserves auto-height text bounds', () => {
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()
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
    const { graph, textEditor, textNode, actions } = setupTextEdit()
    graph.updateNode(textNode.id, { textAutoResize: 'HEIGHT', height: 18 })

    actions.startTextEditing(textNode.id)
    const state = expectDefined(textEditor.state, 'text editor state')
    state.paragraph = deletableParagraphWithHeight(42) as NonNullable<typeof state.paragraph>
    textEditor.insert(' World', getNodeOrThrow(graph, textNode.id))

    expect(() => actions.commitTextEdit()).not.toThrow()
    expect(getNodeOrThrow(graph, textNode.id).height).toBe(42)
  })

  test('commitTextEdit does not push undo when text unchanged', () => {
    const { undo, actions, textNode } = setupTextEdit()

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(undo.canUndo).toBe(false)
  })

  test('commitTextEdit preserves derived glyphs when text unchanged', () => {
    const { graph, actions, textNode } = setupTextEdit()
    const glyphs = [{ commandsBlob: new Uint8Array([0]), x: 0, y: 10, fontSize: 14 }]
    graph.updateNode(textNode.id, { derivedTextGlyphs: glyphs })

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(getNodeOrThrow(graph, textNode.id).derivedTextGlyphs).toBe(glyphs)
  })

  test('undo restores original text even when graph was synced mid-edit', () => {
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()

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
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()

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
    const { graph, undo, textEditor, textNode, actions } = setupTextEdit()

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
    const { graph, undo, textNode, actions } = setupTextEdit()

    actions.startTextEditing(textNode.id)

    const newRuns: StyleRun[] = [{ start: 0, length: 5, style: { fontWeight: 700 } }]
    graph.updateNode(textNode.id, { styleRuns: newRuns })

    actions.commitTextEdit()

    expect(undo.canUndo).toBe(true)

    undo.undo()
    expect(getNodeOrThrow(graph, textNode.id).styleRuns).toEqual([])
  })

  test('no undo entry when neither text nor styleRuns changed', () => {
    const { undo, actions, textNode } = setupTextEdit()

    actions.startTextEditing(textNode.id)
    actions.commitTextEdit()

    expect(undo.canUndo).toBe(false)
  })
})
