import { describe, test, expect } from 'bun:test'

import type { CanvasKit, LineMetrics, Paragraph, RectWithDirection } from 'canvaskit-wasm'

import { TextEditor } from '@open-pencil/core/text'
import type { SceneNode } from '@open-pencil/scene-graph'
import { createDefaultNode } from '@open-pencil/scene-graph/node-defaults'

import { TextLayout } from '#core/canvas/text/layout'

import { expectDefined } from '#tests/helpers/assert'
import { asDouble } from '#tests/helpers/doubles'

const mockCk = asDouble<CanvasKit>({
  RectHeightStyle: { Max: 0 },
  RectWidthStyle: { Tight: 0 }
})

/** A layout of one native paragraph double holding `length` characters. */
function layoutOf(native: Partial<Paragraph>, length: number): TextLayout {
  const paragraph = asDouble<Paragraph>({
    layout: () => undefined,
    didExceedMaxLines: () => false,
    getLongestLine: () => 0,
    ...native
  })
  const layout = TextLayout.ofParagraph(mockCk, paragraph, length)
  layout.layout(100)
  return layout
}

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
  const rects = [asDouble<RectWithDirection>({ rect: [4, 2, 14, 12] })]
  const lineMetrics = {
    endExcludingWhitespaces: 5,
    height: 10,
    left: 3,
    startIndex: 0
  }
  const renderer = asDouble<Parameters<TextEditor['setRenderer']>[0]>({
    buildParagraph: (node: SceneNode) =>
      layoutOf(
        {
          delete: () => undefined,
          getGlyphPositionAtCoordinate: (_x: number, y: number) => {
            hitTestYs.push(y)
            return asDouble({ pos: Math.round(y) })
          },
          getHeight: () => 20,
          getLineMetrics: () => [asDouble(lineMetrics)],
          getGlyphInfoAt: () => null,
          getLineNumberAt: () => 0,
          getRectsForRange: () => rects
        },
        node.text.length
      ),
    fontGeneration: 1
  })
  const editor = new TextEditor(mockCk)
  editor.setRenderer(renderer)
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

  test('places the caret of empty text, which CanvasKit lays out no line for', () => {
    const empty = {
      delete: () => undefined,
      getHeight: () => 0,
      getLineMetrics: () => []
    }
    const space = {
      delete: () => undefined,
      getHeight: () => 17,
      getLineMetrics: () => [asDouble<LineMetrics>({ height: 17, left: 0 })]
    }
    const editor = new TextEditor(mockCk)
    editor.setRenderer(
      asDouble<Parameters<TextEditor['setRenderer']>[0]>({
        buildParagraph: (node: SceneNode) =>
          node.text === '' ? layoutOf(empty, 0) : layoutOf(space, 1),
        fontGeneration: 1
      })
    )
    editor.start(
      createDefaultNode(() => 'new-text', 'TEXT', {
        text: '',
        width: 120,
        height: 57,
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'BOTTOM'
      })
    )
    expect(editor.getCaretRect()).toEqual({ x: 60, y0: 40, y1: 57 })
  })

  test('lays the text out again when its node changes outside the editor', () => {
    const built: number[] = []
    const editor = new TextEditor(mockCk)
    editor.setRenderer(
      asDouble<Parameters<TextEditor['setRenderer']>[0]>({
        buildParagraph: (node: SceneNode) => {
          built.push(node.paragraphSpacing)
          return layoutOf(
            {
              delete: () => undefined,
              getHeight: () => 20,
              getLineMetrics: () => [],
              getRectsForRange: () => []
            },
            node.text.length
          )
        },
        fontGeneration: 1
      })
    )
    const node = createDefaultNode(() => 'spaced-text', 'TEXT', { text: 'A\nB' })
    editor.start(node)
    editor.invalidateParagraph({ ...node, paragraphSpacing: 12 })
    expect(built).toEqual([0])
    // A panel field previews a value: the selection drawn next follows it.
    editor.getSelectionRects()
    editor.getSelectionRects()
    expect(built).toEqual([0, 12])
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

  /** An emoji is one character to the caret, whether a surrogate pair or a joined sequence. */
  test('moves over, and deletes, an emoji whole', () => {
    const family = '👨‍👩‍👧'
    const { editor, node } = createEditor(`a😀${family}b`)
    const state = editorState(editor)
    state.cursor = 1
    editor.moveRight()
    expect(state.cursor).toBe(3)
    editor.moveRight()
    expect(state.cursor).toBe(3 + family.length)
    editor.moveLeft()
    expect(state.cursor).toBe(3)
    editor.backspace(node)
    expect(state.text).toBe(`a${family}b`)
    expect(state.cursor).toBe(1)
    editor.delete(node)
    expect(state.text).toBe('ab')
  })

  /** CanvasKit gives no box for half a character, so the caret beside one takes its cluster's. */
  test('places the caret beside an emoji at the edge of its whole cluster', () => {
    const ranges: Array<[number, number]> = []
    const layout = layoutOf(
      {
        getGlyphInfoAt: (index: number) =>
          index >= 1 && index < 3
            ? asDouble({ graphemeClusterTextRange: { start: 1, end: 3 } })
            : null,
        getHeight: () => 12,
        getLineMetrics: () => [
          asDouble<LineMetrics>({ baseline: 10, ascent: 8, height: 12, left: 0 })
        ],
        getRectsForRange: (start: number, end: number) => {
          ranges.push([start, end])
          return start === 1 && end === 3
            ? [asDouble<RectWithDirection>({ rect: [10, 0, 34, 12] })]
            : []
        }
      },
      4
    )
    expect(layout.getCaretRect(1, false)?.x).toBe(10)
    expect(ranges).toEqual([[1, 3]])
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
