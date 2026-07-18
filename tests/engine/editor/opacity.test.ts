import { describe, test, expect } from 'bun:test'

import { createEditor, opacityFromBuffer } from '@open-pencil/core/editor'

import { getNodeOrThrow } from '#tests/helpers/assert'

describe('editor.setOpacity', () => {
  function setup() {
    const editor = createEditor()
    const pageId = editor.graph.getPages()[0].id
    const rect = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    editor.select([rect.id])
    return { editor, rect }
  }

  test('sets opacity to 50%', () => {
    const { editor, rect } = setup()

    editor.setOpacity(0.5)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.5)
  })

  test('sets opacity to 100% (digit 0)', () => {
    const { editor, rect } = setup()

    editor.setOpacity(0.5)
    editor.setOpacity(1)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
  })

  test('clamps opacity above 100%', () => {
    const { editor, rect } = setup()

    editor.setOpacity(1.5)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
  })

  test('clamps opacity below 0%', () => {
    const { editor, rect } = setup()

    editor.setOpacity(-0.3)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0)
  })

  test('opacity change is undoable as a single batch entry', () => {
    const { editor, rect } = setup()

    editor.setOpacity(0.3)
    expect(editor.undo.canUndo).toBe(true)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.3)
  })

  test('coalesces buffered shortcut updates into one undo entry', () => {
    const { editor, rect } = setup()

    editor.setOpacity(0.2, 'shortcut-session')
    editor.setOpacity(0.28, 'shortcut-session')

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)

    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.28)
  })

  test('keeps separate shortcut sessions as separate undo entries', () => {
    const { editor, rect } = setup()

    editor.setOpacity(0.2, 'shortcut-session-1')
    editor.setOpacity(0.8, 'shortcut-session-2')

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.2)
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
  })

  test('opacity batch for multiple selections collapses to one undo entry', () => {
    const { editor, rect } = setup()
    const pageId = editor.graph.getPages()[0].id
    const rect2 = editor.graph.createNode('RECTANGLE', pageId, {
      name: 'Rect2',
      x: 100,
      y: 0,
      width: 50,
      height: 50
    })
    editor.select([rect.id, rect2.id])

    editor.setOpacity(0.7)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(0.7)
    expect(getNodeOrThrow(editor.graph, rect2.id).opacity).toBe(0.7)

    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
    expect(getNodeOrThrow(editor.graph, rect2.id).opacity).toBe(1)
  })

  test('no-op when opacity already matches', () => {
    const { editor, rect } = setup()

    editor.setOpacity(1)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('no-op with no selection', () => {
    const { editor } = setup()

    editor.clearSelection()
    editor.setOpacity(0.5)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('rejects NaN', () => {
    const { editor, rect } = setup()

    editor.setOpacity(Number.NaN)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('rejects Infinity', () => {
    const { editor, rect } = setup()

    editor.setOpacity(Number.POSITIVE_INFINITY)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
    expect(editor.undo.canUndo).toBe(false)
  })

  test('rejects -Infinity', () => {
    const { editor, rect } = setup()

    editor.setOpacity(Number.NEGATIVE_INFINITY)
    expect(getNodeOrThrow(editor.graph, rect.id).opacity).toBe(1)
    expect(editor.undo.canUndo).toBe(false)
  })
})

describe('opacityFromBuffer', () => {
  test('single 0 returns 100%', () => {
    expect(opacityFromBuffer('0')).toBe(1)
  })

  test('single digit returns decena', () => {
    expect(opacityFromBuffer('5')).toBe(0.5)
    expect(opacityFromBuffer('2')).toBe(0.2)
    expect(opacityFromBuffer('9')).toBe(0.9)
  })

  test('two digits returns literal percent', () => {
    expect(opacityFromBuffer('28')).toBe(0.28)
    expect(opacityFromBuffer('35')).toBe(0.35)
    expect(opacityFromBuffer('00')).toBe(0)
    expect(opacityFromBuffer('05')).toBe(0.05)
  })

  test('three digits clamps to 100%', () => {
    expect(opacityFromBuffer('100')).toBe(1)
    expect(opacityFromBuffer('150')).toBe(1)
  })

  test('invalid buffer returns 100%', () => {
    expect(opacityFromBuffer('')).toBe(1)
    expect(opacityFromBuffer('abc')).toBe(1)
  })

  test('rejects partially numeric buffers', () => {
    expect(opacityFromBuffer('12x')).toBe(1)
    expect(opacityFromBuffer('5abc')).toBe(1)
    expect(opacityFromBuffer('3.5')).toBe(1)
    expect(opacityFromBuffer('1e2')).toBe(1)
    expect(opacityFromBuffer('-5')).toBe(1)
    expect(opacityFromBuffer(' 5')).toBe(1)
  })
})
