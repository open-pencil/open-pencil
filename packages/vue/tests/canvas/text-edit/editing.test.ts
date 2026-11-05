import { afterEach, describe, expect, test } from 'bun:test'

import type { CanvasKit } from 'canvaskit-wasm'

import { createEditor, type Editor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import { getStyleAt, TextEditor } from '@open-pencil/core/text'
import type { CharacterStyleOverride, StyleRun } from '@open-pencil/scene-graph'
import { colorToFill } from '@open-pencil/scene-graph/color'

import { createTextClipboardActions } from '#vue/canvas/text-edit/clipboard'
import { createTextEditActions } from '#vue/canvas/text-edit/editing'
import { createTextFormattingActions } from '#vue/canvas/text-edit/formatting'

const WHITE = colorToFill('#ffffff')
const BLACK = colorToFill('#000000')
const RED = colorToFill('#ff0000')
const WHITE_RUN: CharacterStyleOverride = { fills: [WHITE] }
const RED_RUN: CharacterStyleOverride = { fills: [RED] }
const BOLD_BOUND_RUN: CharacterStyleOverride = {
  fontFamily: 'Inter',
  fontWeight: 700,
  boundVariables: { fontSize: 'VariableID:1:1' }
}

let editor: Editor
let releaseRenderer: (() => void) | null = null
const originalNavigator = globalThis.navigator

afterEach(() => {
  editor.dispose()
  releaseRenderer?.()
  releaseRenderer = null
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

  test('typing over a selection across several runs takes the style of its first character', () => {
    const text = editStyledText('abcdef', [
      { start: 0, length: 2, style: WHITE_RUN },
      { start: 2, length: 2, style: RED_RUN }
    ])
    placeCaret(text, 5, 1)
    text.actions.insertText('X', text.read())

    expect(text.read().text).toBe('aXf')
    expect(fillAt(text, 1)).toEqual([WHITE])
    expect(fillAt(text, 2)).toEqual([BLACK])
  })

  test('an input method composition over a selection takes the style of its first character', () => {
    const text = editStyledText('Lead tail', [{ start: 0, length: 4, style: WHITE_RUN }])
    placeCaret(text, 7, 2)
    text.actions.replaceComposedText('x', text.read())
    text.actions.replaceComposedText('xy', text.read())
    text.actions.finishComposition()

    expect(text.read().text).toBe('Lexyil')
    expect(fillAt(text, 2)).toEqual([WHITE])
    expect(fillAt(text, 3)).toEqual([WHITE])
    expect(fillAt(text, 4)).toEqual([BLACK])
  })

  test('a cancelled composition restores the runs it replaced exactly', () => {
    const runs: StyleRun[] = [
      { start: 0, length: 2, style: WHITE_RUN },
      { start: 2, length: 2, style: RED_RUN }
    ]
    const text = editStyledText('abcdef', runs)
    placeCaret(text, 3, 1)
    text.actions.replaceComposedText('k', text.read())
    text.actions.replaceComposedText('ka', text.read())
    text.actions.replaceComposedText('kan', text.read())
    text.actions.restoreComposition(text.read())

    expect(text.read().text).toBe('abcdef')
    expect(text.read().styleRuns).toEqual(runs)
  })
})

describe('typing into text emptied while editing it', () => {
  test('typing after deleting every character keeps the style of the deleted text', () => {
    const text = editWhiteRunText('Title')
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)

    expect(text.read().text).toBe('')
    expect(text.read().styleRuns).toEqual([])

    text.actions.insertText('A', text.read())

    expect(text.read().styleRuns).toEqual([{ start: 0, length: 1, style: WHITE_RUN }])
  })

  test('typing after deleting every character keeps the font and variable bindings', () => {
    const text = editStyledText('Bold', [{ start: 0, length: 4, style: BOLD_BOUND_RUN }])
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)
    text.actions.insertText('A', text.read())

    expect(text.read().styleRuns).toEqual([{ start: 0, length: 1, style: BOLD_BOUND_RUN }])
  })

  test('the emptied text keeps the deleted style while fonts arriving later resize it', () => {
    const text = editWhiteRunText('Title')
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)
    text.store.graph.updateNode(text.read().id, {
      width: 120,
      height: 24,
      derivedLayout: null,
      derivedTextGlyphs: null,
      derivedTextHeight: null
    })
    text.actions.insertText('A', text.read())

    expect(text.read().styleRuns).toEqual([{ start: 0, length: 1, style: WHITE_RUN }])
  })

  test('deleting a selection then typing matches typing over it', () => {
    const text = editStyledText('abcdef', [
      { start: 0, length: 2, style: WHITE_RUN },
      { start: 2, length: 2, style: RED_RUN }
    ])
    placeCaret(text, 6, 2)
    text.actions.deleteText(text.read(), false)
    placeCaret(text, 0, 2)
    text.actions.deleteText(text.read(), true)
    text.actions.insertText('X', text.read())

    expect(text.read().text).toBe('X')
    expect(fillAt(text, 0)).toEqual([WHITE])
  })

  test('the last character deleted with backspace gives the style', () => {
    const text = editStyledText('ab', [
      { start: 0, length: 1, style: WHITE_RUN },
      { start: 1, length: 1, style: RED_RUN }
    ])
    text.actions.deleteText(text.read(), false)
    text.actions.deleteText(text.read(), false)
    text.actions.insertText('c', text.read())

    expect(fillAt(text, 0)).toEqual([WHITE])
  })

  test('the last character deleted forward gives the style', () => {
    const text = editStyledText('ab', [
      { start: 0, length: 1, style: WHITE_RUN },
      { start: 1, length: 1, style: RED_RUN }
    ])
    placeCaret(text, 0)
    text.actions.deleteText(text.read(), true)
    text.actions.deleteText(text.read(), true)
    text.actions.insertText('c', text.read())

    expect(fillAt(text, 0)).toEqual([RED])
  })

  test('an input method composition into emptied text keeps the deleted style', () => {
    const text = editWhiteRunText('Title')
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)
    text.actions.replaceComposedText('k', text.read())
    text.actions.replaceComposedText('ka', text.read())
    text.actions.finishComposition()

    expect(text.read().text).toBe('ka')
    expect(text.read().styleRuns).toEqual([{ start: 0, length: 2, style: WHITE_RUN }])
  })

  test('a new editing session on the emptied text starts from the base style', () => {
    const text = editWhiteRunText('Title')
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)
    text.textEditor.stop()
    text.textEditor.start(text.read())
    text.actions.insertText('A', text.read())

    expect(text.read().styleRuns).toEqual([])
    expect(fillAt(text, 0)).toEqual([BLACK])
  })
})

describe('formatting a text emptied while editing it', () => {
  function emptiedText(style: CharacterStyleOverride) {
    const text = editStyledText('Title', [{ start: 0, length: 5, style }])
    text.textEditor.selectAll()
    text.actions.deleteText(text.read(), false)
    return text
  }

  function styleOfTyped(text: EditedText) {
    return { ...text.read(), ...getStyleAt(text.read().styleRuns, 0) }
  }

  test('a fill chosen while the text is empty colours what is typed next', () => {
    const text = emptiedText(WHITE_RUN)
    text.store.updateNodeWithUndo(text.read().id, { fills: [RED] }, 'Change fill')
    text.actions.insertText('A', text.read())

    expect(fillAt(text, 0)).toEqual([RED])
  })

  test('a font size chosen while the text is empty sizes what is typed next', () => {
    const text = emptiedText({ fontSize: 32 })
    text.store.updateNodeWithUndo(text.read().id, { fontSize: 48 }, 'Change font size')
    text.actions.insertText('A', text.read())

    expect(styleOfTyped(text).fontSize).toBe(48)
  })

  test.each([
    ['bold', 'toggleBold', { fontWeight: 400 }, { fontWeight: 700 }],
    ['italic', 'toggleItalic', { italic: false }, { italic: true }],
    ['underline', 'toggleUnderline', { textDecoration: 'NONE' }, { textDecoration: 'UNDERLINE' }]
  ] as const)(
    '%s toggled while the text is empty applies to what is typed next',
    (_name, toggle, deleted, toggled) => {
      const text = emptiedText(deleted)
      createTextFormattingActions(text.store)[toggle](text.read())
      text.actions.insertText('A', text.read())

      expect(styleOfTyped(text)).toMatchObject(toggled)
    }
  )
})

describe('undoing back to a text emptied while editing it', () => {
  async function editEmptyText() {
    const ck = await initCanvasKit()
    const surface = ck.MakeSurface(200, 200)
    if (!surface) {
      throw new Error('no surface')
    }
    const renderer = new SkiaRenderer(ck, surface)
    editor = createEditor()
    editor.setCanvasKit(ck, renderer)
    await renderer.loadFonts()
    releaseRenderer = () => renderer.destroy()
    const node = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: '',
      fills: [BLACK],
      width: 200,
      height: 20
    })
    editor.startTextEditing(node.id)
    const read = () => editor.graph.getNode(node.id) ?? node
    return { read, actions: createTextEditActions(editor) }
  }

  test('typing after undoing to the empty text takes the base style', async () => {
    const { read, actions } = await editEmptyText()
    actions.insertText('abc', read())
    editor.updateNodeWithUndo(
      read().id,
      { styleRuns: [{ start: 0, length: 3, style: WHITE_RUN }] },
      'Colour text'
    )
    editor.textEditor?.selectAll()
    actions.deleteText(read(), false)
    editor.undoAction()
    editor.undoAction()
    editor.undoAction()

    expect(read().text).toBe('')

    actions.insertText('A', read())

    expect(getStyleAt(read().styleRuns, 0).fills ?? read().fills).toEqual([BLACK])
  })
})
