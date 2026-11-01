import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import {
  createSticky,
  shapeWithTextLabel,
  stickySublayers
} from '@open-pencil/scene-graph/generated'

function setup() {
  const editor = createEditor({ loadFont: () => Promise.resolve(null) })
  return { editor, pageId: editor.state.currentPageId }
}

describe('FigJam typefaces and sizes', () => {
  test('a typeface sets the text that a shape or a sticky note is named by', async () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    const sticky = createSticky(editor.graph, pageId, {})
    await editor.setFigJamTypeface([id, sticky.id], 'technical')
    const shape = expectDefined(editor.graph.getNode(id))
    expect(shapeWithTextLabel(editor.graph, shape)?.fontFamily).toBe('Roboto Mono')
    expect(stickySublayers(editor.graph, sticky)?.body.fontFamily).toBe('Roboto Mono')
  })

  test('a typeface leaves the text style it replaces', async () => {
    const { editor, pageId } = setup()
    const sticky = createSticky(editor.graph, pageId, {})
    const body = expectDefined(stickySublayers(editor.graph, sticky)).body
    editor.graph.updateNode(body.id, { textStyleId: 'text-style' })
    await editor.setFigJamTypeface([sticky.id], 'technical')
    expect(editor.graph.getNode(body.id)?.textStyleId).toBeNull()
  })

  test('a typeface and a FigJam size set a text layer too', async () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('TEXT', 0, 0, 100, 20, pageId)
    await editor.setFigJamTypeface([id], 'bookish')
    editor.setFigJamTextSize([id], 'large')
    expect(editor.graph.getNode(id)).toMatchObject({ fontFamily: 'Merriweather', fontSize: 40 })
  })

  test('a typeface sets every character, and a FigJam size sets every character too', async () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('TEXT', 0, 0, 100, 20, pageId)
    editor.graph.updateNode(id, {
      text: 'Hello',
      styleRuns: [{ start: 0, length: 2, style: { fontFamily: 'Roboto', fontSize: 30 } }]
    })
    await editor.setFigJamTypeface([id], 'bookish')
    // The face reaches the range; its own size stays until a size is chosen.
    expect(editor.graph.getNode(id)?.styleRuns).toEqual([
      { start: 0, length: 2, style: { fontSize: 30 } }
    ])
    editor.setFigJamTextSize([id], 'large')
    expect(editor.graph.getNode(id)?.styleRuns).toEqual([])
  })

  test('a FigJam size sets text and sticky notes together, in one undo step', () => {
    const { editor, pageId } = setup()
    const text = editor.createShape('TEXT', 0, 0, 100, 20, pageId)
    const sticky = createSticky(editor.graph, pageId, {})
    editor.setFigJamTextSize([text, sticky.id], 'huge')
    const body = expectDefined(stickySublayers(editor.graph, sticky)).body
    expect([editor.graph.getNode(text)?.fontSize, editor.graph.getNode(body.id)?.fontSize]).toEqual([96, 96])
    editor.undo.undo()
    expect(editor.graph.getNode(text)?.fontSize).not.toBe(96)
    expect(editor.graph.getNode(body.id)?.fontSize).not.toBe(96)
  })
})
