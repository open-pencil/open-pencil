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

describe('typefaces of generated text', () => {
  test('a typeface sets the text that a shape or a sticky note is named by', async () => {
    const { editor, pageId } = setup()
    const id = editor.createShape('SHAPE_WITH_TEXT', 0, 0, 176, 176, pageId)
    const sticky = createSticky(editor.graph, pageId, {})
    await editor.setGeneratedTextTypeface([id, sticky.id], 'technical')
    const shape = expectDefined(editor.graph.getNode(id))
    expect(shapeWithTextLabel(editor.graph, shape)?.fontFamily).toBe('Roboto Mono')
    expect(stickySublayers(editor.graph, sticky)?.body.fontFamily).toBe('Roboto Mono')
  })

  test('a typeface leaves the text style it replaces', async () => {
    const { editor, pageId } = setup()
    const sticky = createSticky(editor.graph, pageId, {})
    const body = expectDefined(stickySublayers(editor.graph, sticky)).body
    editor.graph.updateNode(body.id, { textStyleId: 'text-style' })
    await editor.setGeneratedTextTypeface([sticky.id], 'technical')
    expect(editor.graph.getNode(body.id)?.textStyleId).toBeNull()
  })
})
