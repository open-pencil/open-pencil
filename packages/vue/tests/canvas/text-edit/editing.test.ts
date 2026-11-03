import { afterEach, describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { createEditor, type Editor } from '@open-pencil/core'
import { getStyleAt, TextEditor } from '@open-pencil/core/text'
import type { CharacterStyleOverride, StyleRun } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'

import { createTextClipboardActions } from '#vue/canvas/text-edit/clipboard'
import { createTextEditActions } from '#vue/canvas/text-edit/editing'

const WHITE = colorToFill('#ffffff')
const BLACK = colorToFill('#000000')
const WHITE_RUN: CharacterStyleOverride = { fills: [WHITE] }
const BOLD_BOUND_RUN: CharacterStyleOverride = {
  fontFamily: 'Inter',
  fontWeight: 700,
  boundVariables: { fontSize: 'VariableID:1:1' }
}

let editor: Editor
const originalNavigator = globalThis.navigator

afterEach(() => {
  editor.dispose()
  Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true })
})

function editStyledText(text: string, styleRuns: StyleRun[]) {
  editor = createEditor()
  const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text,
    fills: [BLACK],
    styleRuns
  })
  const canvasKitUnusedWithoutRenderer: CanvasKit = Object.create(null)
  const textEditor = new TextEditor(canvasKitUnusedWithoutRenderer)
  const store: Editor = Object.create(editor)
  Object.defineProperty(store, 'textEditor', { value: textEditor })
  editor.state.editingTextId = node.id
  textEditor.start(node)
  const read = () => editor.graph.getNode(node.id) ?? node
  return { read, store, textEditor, actions: createTextEditActions(store) }
}

function editWhiteRunText(text: string) {
  return editStyledText(text, [{ start: 0, length: text.length, style: WHITE_RUN }])
}

type EditedText = ReturnType<typeof editStyledText>

function fillAt(text: EditedText, index: number) {
  return getStyleAt(text.read().styleRuns, index).fills ?? text.read().fills
}

function placeCaret(text: EditedText, cursor: number, selectionAnchor: number | null = null) {
  const state = text.textEditor.state
  if (state) {
    state.cursor = cursor
    state.selectionAnchor = selectionAnchor
  }
}

function clipboardHolding(content: string) {
  const clipboard = { readText: () => Promise.resolve(content) }
  Object.defineProperty(globalThis, 'navigator', {
    value: { ...originalNavigator, clipboard },
    configurable: true
  })
}

describe('typing into text coloured by its character runs', () => {
  test('a new line typed at the end keeps the colour of the line before it', () => {
    const text = editWhiteRunText('Title')
    text.actions.insertText('\n', text.read())
    text.actions.insertText('Next', text.read())

    expect(text.read().text).toBe('Title\nNext')
    expect(fillAt(text, 5)).toEqual([WHITE])
    expect(fillAt(text, 9)).toEqual([WHITE])
  })

  test('characters typed at the start take the colour of the first character', () => {
    const text = editWhiteRunText('Title')
    placeCaret(text, 0)
    text.actions.insertText('A', text.read())

    expect(text.read().text).toBe('ATitle')
    expect(fillAt(text, 0)).toEqual([WHITE])
  })

  test('typing over the whole selection keeps the colour of the replaced text', () => {
    const text = editWhiteRunText('Title')
    text.textEditor.selectAll()
    text.actions.insertText('New', text.read())

    expect(text.read().text).toBe('New')
    expect(fillAt(text, 0)).toEqual([WHITE])
    expect(fillAt(text, 2)).toEqual([WHITE])
  })

  test('typing over a selection takes the style of its first character', () => {
    const text = editStyledText('Lead tail', [{ start: 0, length: 4, style: WHITE_RUN }])
    placeCaret(text, 7, 2)
    text.actions.insertText('xy', text.read())

    expect(text.read().text).toBe('Lexyil')
    expect(fillAt(text, 2)).toEqual([WHITE])
    expect(fillAt(text, 3)).toEqual([WHITE])
    expect(fillAt(text, 4)).toEqual([BLACK])
  })

  test('typing at the end of a run keeps that run over the base style after it', () => {
    const text = editStyledText('Lead tail', [{ start: 0, length: 4, style: WHITE_RUN }])
    placeCaret(text, 4)
    text.actions.insertText('s', text.read())

    expect(text.read().text).toBe('Leads tail')
    expect(fillAt(text, 4)).toEqual([WHITE])
    expect(fillAt(text, 5)).toEqual([BLACK])
  })

  test('typing into a text without characters adds no runs', () => {
    const text = editStyledText('', [])
    text.actions.insertText('A', text.read())

    expect(text.read().text).toBe('A')
    expect(text.read().styleRuns).toEqual([])
  })

  test('an input method composition at the end of a run keeps the run colour', () => {
    const text = editWhiteRunText('Title')
    text.actions.replaceComposedText('k', text.read())
    text.actions.replaceComposedText('ka', text.read())
    text.actions.finishComposition()

    expect(text.read().text).toBe('Titleka')
    expect(fillAt(text, 5)).toEqual([WHITE])
    expect(fillAt(text, 6)).toEqual([WHITE])
  })

  test('plain text pasted while editing keeps the run colour', async () => {
    const text = editWhiteRunText('Title')
    clipboardHolding(' pasted')
    let blinkResets = 0
    const clipboard = createTextClipboardActions({
      store: text.store,
      insertText: text.actions.insertText,
      deleteText: text.actions.deleteText,
      resetBlink: () => {
        blinkResets++
      }
    })
    await clipboard.handlePaste(text.read())

    expect(text.read().text).toBe('Title pasted')
    expect(blinkResets).toBe(1)
    expect(fillAt(text, 11)).toEqual([WHITE])
  })

  test('font weight and bound variables survive typing at the end of a run', () => {
    const text = editStyledText('Bold', [{ start: 0, length: 4, style: BOLD_BOUND_RUN }])
    text.actions.insertText('er', text.read())

    expect(text.read().text).toBe('Bolder')
    expect(getStyleAt(text.read().styleRuns, 5)).toEqual(BOLD_BOUND_RUN)
  })
})
