import { describe, test, expect } from 'bun:test'

import type { CanvasKit, Paragraph, RectWithDirection } from 'canvaskit-wasm'

import { TextEditor, type SceneNode } from '@open-pencil/core'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { expectDefined } from '#tests/helpers/assert'

const mockCk = {
  RectHeightStyle: { Max: 0 },
  RectWidthStyle: { Tight: 0 }
} as Pick<CanvasKit, 'RectHeightStyle' | 'RectWidthStyle'> as CanvasKit

function createEditor(text = 'Hello World') {
  const editor = new TextEditor(mockCk)
  const node = { id: 'test-node', text } as SceneNode
  editor.start(node)
  return { editor, node }
}

function editorState(editor: TextEditor) {
  return expectDefined(editor.state, 'text editor state')
}

function createParagraphEditor(textAlignVertical: SceneNode['textAlignVertical']) {
  const hitTestYs: number[] = []
  const rects = [{ rect: [4, 2, 14, 12] }] as RectWithDirection[]
  const lineMetrics = {
    endExcludingWhitespaces: 5,
    height: 10,
    left: 3,
    startIndex: 0
  }
  const paragraph = {
    delete: () => undefined,
    getGlyphPositionAtCoordinate: (_x: number, y: number) => {
      hitTestYs.push(y)
      return { pos: Math.round(y) }
    },
    getHeight: () => 20,
    getLineMetrics: () => [lineMetrics],
    getLineMetricsAt: () => lineMetrics,
    getLineNumberAt: () => 0,
    getRectsForRange: () => rects
  } as Pick<
    Paragraph,
    | 'delete'
    | 'getGlyphPositionAtCoordinate'
    | 'getHeight'
    | 'getLineMetrics'
    | 'getLineMetricsAt'
    | 'getLineNumberAt'
    | 'getRectsForRange'
  > as Paragraph
  const renderer = {
    buildParagraph: () => paragraph,
    fontGeneration: 1
  }
  const editor = new TextEditor(mockCk)
  editor.setRenderer(renderer as Parameters<TextEditor['setRenderer']>[0])
  const node = createDefaultNode(() => 'aligned-text', 'TEXT', {
    height: 100,
    text: 'Hello',
    textAlignVertical
  })
  editor.start(node)
  return { editor, hitTestYs }
}

describe('TextEditor', () => {
  test('start initializes state', () => {
    const { editor } = createEditor()
    expect(editor.isActive).toBe(true)
    expect(editor.nodeId).toBe('test-node')
    expect(editor.state?.text).toBe('Hello World')
    expect(editor.state?.cursor).toBe(11)
  })

  test('stop returns result and clears state', () => {
    const { editor } = createEditor()
    const result = editor.stop()
    expect(result?.nodeId).toBe('test-node')
    expect(result?.text).toBe('Hello World')
    expect(editor.isActive).toBe(false)
    expect(editor.nodeId).toBeNull()
  })

  test('stop on inactive returns null', () => {
    const editor = new TextEditor(mockCk)
    expect(editor.stop()).toBeNull()
  })

  test('insert at end', () => {
    const { editor, node } = createEditor()
    editor.insert('!', node)
    expect(editor.state?.text).toBe('Hello World!')
    expect(editor.state?.cursor).toBe(12)
  })

  test('insert at cursor position', () => {
    const { editor, node } = createEditor()
    editorState(editor).cursor = 5
    editor.insert(' Beautiful', node)
    expect(editor.state?.text).toBe('Hello Beautiful World')
  })

  test('insert replaces selection', () => {
    const { editor, node } = createEditor()
    editorState(editor).selectionAnchor = 0
    editorState(editor).cursor = 5
    editor.insert('Goodbye', node)
    expect(editor.state?.text).toBe('Goodbye World')
    expect(editor.state?.cursor).toBe(7)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('backspace deletes char before cursor', () => {
    const { editor, node } = createEditor()
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello Worl')
    expect(editor.state?.cursor).toBe(10)
  })

  test('backspace at start does nothing', () => {
    const { editor, node } = createEditor()
    editorState(editor).cursor = 0
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello World')
  })

  test('backspace deletes selection', () => {
    const { editor, node } = createEditor()
    editorState(editor).selectionAnchor = 6
    editorState(editor).cursor = 11
    editor.backspace(node)
    expect(editor.state?.text).toBe('Hello ')
    expect(editor.state?.cursor).toBe(6)
  })

  test('delete removes char after cursor', () => {
    const { editor, node } = createEditor()
    editorState(editor).cursor = 0
    editor.delete(node)
    expect(editor.state?.text).toBe('ello World')
    expect(editor.state?.cursor).toBe(0)
  })

  test('delete at end does nothing', () => {
    const { editor, node } = createEditor()
    editor.delete(node)
    expect(editor.state?.text).toBe('Hello World')
  })

  test('delete removes selection', () => {
    const { editor, node } = createEditor()
    editorState(editor).selectionAnchor = 0
    editorState(editor).cursor = 5
    editor.delete(node)
    expect(editor.state?.text).toBe(' World')
  })

  test('offsets hit testing, caret, and selection for vertical alignment', () => {
    for (const [alignment, offset] of [
      ['TOP', 0],
      ['CENTER', 40],
      ['BOTTOM', 80]
    ] as const) {
      const { editor, hitTestYs } = createParagraphEditor(alignment)
      editorState(editor).selectionAnchor = 0
      editorState(editor).cursor = 5

      expect(editor.getSelectionRects()).toEqual([{ x: 4, y: 2 + offset, width: 10, height: 10 }])
      editorState(editor).selectionAnchor = null
      expect(editor.getCaretRect()).toEqual({ x: 14, y0: 2 + offset, y1: 12 + offset })

      editor.setCursorAt(4, offset + 3)
      expect(hitTestYs.at(-1)).toBe(3)
      expect(editorState(editor).cursor).toBe(3)

      editor.selectWordAt(4, offset + 2)
      expect(hitTestYs.at(-1)).toBe(2)
      expect(editor.getSelectionRange()).toEqual([0, 5])

      editor.selectLineAt(4, offset + 4)
      expect(hitTestYs.at(-1)).toBe(4)
      expect(editor.getSelectionRange()).toEqual([0, 5])

      editorState(editor).selectionAnchor = null
      editorState(editor).cursor = 1
      editor.moveUp()
      expect(hitTestYs.at(-1)).toBe(-3)

      editorState(editor).cursor = 1
      editor.moveDown()
      expect(hitTestYs.at(-1)).toBe(17)
    }
  })

  test('offsets the empty-text caret for vertical alignment', () => {
    const { editor } = createParagraphEditor('BOTTOM')
    editorState(editor).text = ''
    editorState(editor).cursor = 0

    expect(editor.getCaretRect()).toEqual({ x: 3, y0: 80, y1: 90 })
  })

  test('moveLeft', () => {
    const { editor } = createEditor()
    editor.moveLeft()
    expect(editor.state?.cursor).toBe(10)
  })

  test('moveRight at end stays', () => {
    const { editor } = createEditor()
    editor.moveRight()
    expect(editor.state?.cursor).toBe(11)
  })

  test('moveLeft collapses selection to start', () => {
    const { editor } = createEditor()
    editorState(editor).selectionAnchor = 3
    editorState(editor).cursor = 8
    editor.moveLeft()
    expect(editor.state?.cursor).toBe(3)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('moveRight collapses selection to end', () => {
    const { editor } = createEditor()
    editorState(editor).selectionAnchor = 3
    editorState(editor).cursor = 8
    editor.moveRight()
    expect(editor.state?.cursor).toBe(8)
    expect(editor.state?.selectionAnchor).toBeNull()
  })

  test('selectAll', () => {
    const { editor } = createEditor()
    editor.selectAll()
    expect(editor.state?.selectionAnchor).toBe(0)
    expect(editor.state?.cursor).toBe(11)
  })

  test('hasSelection', () => {
    const { editor } = createEditor()
    expect(editor.hasSelection()).toBe(false)
    editorState(editor).selectionAnchor = 0
    expect(editor.hasSelection()).toBe(true)
  })

  test('hasSelection false when anchor equals cursor', () => {
    const { editor } = createEditor()
    editorState(editor).selectionAnchor = editorState(editor).cursor
    expect(editor.hasSelection()).toBe(false)
  })

  test('getSelectionRange', () => {
    const { editor } = createEditor()
    expect(editor.getSelectionRange()).toBeNull()
    editorState(editor).selectionAnchor = 8
    editorState(editor).cursor = 3
    expect(editor.getSelectionRange()).toEqual([3, 8])
  })

  test('getSelectedText', () => {
    const { editor } = createEditor()
    editorState(editor).selectionAnchor = 0
    editorState(editor).cursor = 5
    expect(editor.getSelectedText()).toBe('Hello')
  })

  test('selectWord', () => {
    const { editor } = createEditor()
    editor.selectWord(2)
    expect(editor.state?.selectionAnchor).toBe(0)
    expect(editor.state?.cursor).toBe(5)
  })

  test('selectWord on second word', () => {
    const { editor } = createEditor()
    editor.selectWord(8)
    expect(editor.state?.selectionAnchor).toBe(6)
    expect(editor.state?.cursor).toBe(11)
  })

  test('moveWordLeft', () => {
    const { editor } = createEditor()
    editor.moveWordLeft()
    expect(editor.state?.cursor).toBe(6)
  })

  test('moveWordRight from start', () => {
    const { editor } = createEditor()
    editorState(editor).cursor = 0
    editor.moveWordRight()
    expect(editor.state?.cursor).toBe(6)
  })

  test('moveLeft with extend creates selection', () => {
    const { editor } = createEditor()
    editorState(editor).cursor = 5
    editor.moveLeft(true)
    expect(editor.state?.selectionAnchor).toBe(5)
    expect(editor.state?.cursor).toBe(4)
  })
})
