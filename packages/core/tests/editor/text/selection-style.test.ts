import { afterEach, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit } from '@open-pencil/core/io/formats/raster'
import type { Fill } from '@open-pencil/scene-graph'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

const RED: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}

/** An editor editing "Hello world" with "world" selected. */
async function editingWorld() {
  const ck = await initCanvasKit()
  const surface = expectDefined(ck.MakeSurface(200, 200), 'surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  await renderer.loadFonts()
  cleanups.push(() => {
    editor.dispose()
    renderer.destroy()
  })
  const page = editor.state.currentPageId
  const text = editor.graph.createNode('TEXT', page, {
    text: 'Hello world',
    width: 200,
    height: 20
  })
  editor.startTextEditing(text.id)
  const state = expectDefined(editor.textEditor?.state, 'text editor state')
  state.selectionAnchor = 6
  state.cursor = 11
  const node = () => expectDefined(editor.graph.getNode(text.id), 'text')
  return { editor, id: text.id, node }
}

describe('panel edits while text is edited', () => {
  test('fill the selected characters, not the layer, and undo the fill', async () => {
    const { editor, id, node } = await editingWorld()
    const layerFills = node().fills

    editor.updateNodeWithUndo(id, { fills: [RED] }, 'Change fill')

    expect(node().fills).toEqual(layerFills)
    expect(node().styleRuns).toEqual([{ start: 6, length: 5, style: { fills: [RED] } }])
    expect(editor.getTextSelectionStyle(node())?.fills).toEqual([RED])

    editor.undoAction()
    expect(node().styleRuns).toEqual([])
  })

  test('record a dragged size as one step back to the runs it started from', async () => {
    const { editor, id, node } = await editingWorld()

    editor.updateNode(id, { fontSize: 30 })
    editor.updateNode(id, { fontSize: 40 })
    editor.commitNodeUpdate(id, { fontSize: 14 }, 'Change fontSize')

    expect(node().fontSize).toBe(14)
    expect(node().styleRuns).toEqual([{ start: 6, length: 5, style: { fontSize: 40 } }])
    editor.undoAction()
    expect(node().styleRuns).toEqual([])
    editor.redoAction()
    expect(node().styleRuns).toEqual([{ start: 6, length: 5, style: { fontSize: 40 } }])
  })

  test('style the layer when no characters are selected', async () => {
    const { editor, id, node } = await editingWorld()
    const state = expectDefined(editor.textEditor?.state, 'text editor state')
    state.selectionAnchor = null

    editor.updateNodeWithUndo(id, { fills: [RED] }, 'Change fill')

    expect(node().fills).toEqual([RED])
    expect(node().styleRuns).toEqual([])
    expect(editor.getTextSelectionStyle(node())).toBeNull()
  })
})

describe('text case while text is edited', () => {
  test('case the selected characters and show their case', async () => {
    const { editor, id, node } = await editingWorld()

    editor.updateNodeWithUndo(id, { textCase: 'UPPER' }, 'Change text case')

    expect(node().textCase).toBe('ORIGINAL')
    expect(node().styleRuns).toEqual([{ start: 6, length: 5, style: { textCase: 'UPPER' } }])
    expect(editor.getTextSelectionStyle(node())?.textCase).toBe('UPPER')
    editor.undoAction()
    expect(node().styleRuns).toEqual([])
  })

  test('show only the layer properties of the selected characters', async () => {
    const { editor, node } = await editingWorld()
    const style = expectDefined(editor.getTextSelectionStyle(node()), 'selection style')
    expect(Object.keys(style)).not.toContain('boundVariables')
    expect(Object.keys(style)).not.toContain('hyperlink')
  })
})

describe('panel edits to a text layer whose characters a range styled', () => {
  const BLUE: Fill = { ...RED, color: { r: 0, g: 0, b: 1, a: 1 } }

  /** "Hello" drawn at 40 and red by a range over all of it, over the layer's own 14. */
  function rangeStyled() {
    const editor = createEditor()
    cleanups.push(() => editor.dispose())
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      fontSize: 14,
      styleRuns: [{ start: 0, length: 5, style: { fontSize: 40, fills: [RED] } }]
    })
    const node = () => expectDefined(editor.graph.getNode(text.id), 'text')
    return { editor, id: text.id, node }
  }

  test('show the style its characters are drawn in', () => {
    const { editor, node } = rangeStyled()
    expect(editor.getTextSelectionStyle(node())).toMatchObject({ fontSize: 40, fills: [RED] })
  })

  test('style every character, as Figma does, and undo to the range', () => {
    const { editor, id, node } = rangeStyled()
    const runs = node().styleRuns

    editor.updateNodeWithUndo(id, editor.layerChanges(id, { fontSize: 24 }), 'Change fontSize')
    expect(node().fontSize).toBe(24)
    expect(node().styleRuns).toEqual([{ start: 0, length: 5, style: { fills: [RED] } }])

    editor.updateNodeWithUndo(id, editor.layerChanges(id, { fills: [BLUE] }), 'Change fills')
    expect(node().fills).toEqual([BLUE])
    expect(node().styleRuns).toEqual([])

    editor.undoAction()
    editor.undoAction()
    expect(node().fontSize).toBe(14)
    expect(node().styleRuns).toEqual(runs)
  })

  test('leave no empty range on a copy once every character takes the style', () => {
    const { editor, id } = rangeStyled()
    editor.select([id])
    editor.duplicateSelected()
    const [copy] = editor.state.selectedIds
    editor.updateNodeWithUndo(
      copy,
      editor.layerChanges(copy, { fontSize: 24, fills: [BLUE] }),
      'Change style'
    )
    expect(editor.graph.getNode(copy)?.styleRuns).toEqual([])
  })

  test('leave a change that styles nothing as it is', () => {
    const { editor, id } = rangeStyled()
    expect(editor.layerChanges(id, { textAlignHorizontal: 'CENTER' })).toEqual({
      textAlignHorizontal: 'CENTER'
    })
  })
})
