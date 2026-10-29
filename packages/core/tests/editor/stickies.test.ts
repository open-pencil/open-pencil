import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'
import { STICKY_COLORS, stickySublayers } from '@open-pencil/scene-graph/generated'
import { lineHeightPixels, percentLength } from '@open-pencil/scene-graph/text'

import { applyGeneratedTextNameEdit } from '#core/editor/text/name'

import { expectDefined } from '../helpers/assert'

function setup() {
  const editor = createEditor({ getUserName: () => 'Ada Lovelace' })
  return { editor, pageId: editor.state.currentPageId }
}

function sublayers(editor: ReturnType<typeof setup>['editor'], sticky: SceneNode) {
  return expectDefined(stickySublayers(editor.graph, sticky))
}

beforeEach(() => {
  setTextMeasurer((node, maxWidth) => ({
    width: maxWidth ?? node.width,
    height:
      node.text.split('\n').length *
      (lineHeightPixels(node.lineHeight, node.fontSize) ?? node.fontSize)
  }))
})
afterEach(() => setTextMeasurer(null))

describe('sticky notes', () => {
  test('a placed note is centred, signed by the user, selected, and one undo step', () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 500, y: 300 })
    expect([sticky.x, sticky.y, sticky.width, sticky.height]).toEqual([380, 180, 240, 240])
    expect(sublayers(editor, sticky).author.text).toBe('Ada Lovelace')
    expect([...editor.state.selectedIds]).toEqual([sticky.id])

    editor.undo.undo()
    expect(editor.graph.getNode(sticky.id)).toBeUndefined()
    editor.undo.redo()
    const restored = editor.graph.getNode(sticky.id)
    expect(restored && sublayers(editor, restored).author.text).toBe('Ada Lovelace')
  })

  test('the next note takes the colour picked last', () => {
    const { editor, pageId } = setup()
    const first = editor.createStickyNote(pageId, { x: 0, y: 0 })
    editor.setStickyColor([first.id], STICKY_COLORS.pink)
    expect(editor.graph.getNode(first.id)?.fills[0]?.color).toEqual(STICKY_COLORS.pink)
    const second = editor.createStickyNote(pageId, { x: 400, y: 0 })
    expect(second.fills[0]?.color).toEqual(STICKY_COLORS.pink)
  })

  test('text size and author changes are single undo steps over the whole note', () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 0, y: 0 })
    editor.setStickyTextSize([sticky.id], 'large')
    expect(sublayers(editor, sticky).body).toMatchObject({ fontSize: 40, lineHeight: percentLength(150) })
    editor.setStickyAuthorVisible([sticky.id], false)
    expect(sublayers(editor, sticky).author.visible).toBe(false)

    editor.undo.undo()
    const shown = expectDefined(editor.graph.getNode(sticky.id))
    expect(sublayers(editor, shown).author.visible).toBe(true)
    editor.undo.undo()
    const small = expectDefined(editor.graph.getNode(sticky.id))
    expect(sublayers(editor, small).body.fontSize).toBe(16)
  })

  test('scaling a note scales its text and spacing from the corner it keeps', () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 120, y: 120 })
    editor.scaleStickyNote(sticky.id, 1.5, { x: 0, y: 0 })
    const scaled = expectDefined(editor.graph.getNode(sticky.id))
    expect(scaled).toMatchObject({ width: 360, height: 360, paddingTop: 30, minHeight: 360 })
    expect(sublayers(editor, scaled).author.fontSize).toBe(18)
    editor.undo.undo()
    expect(editor.graph.getNode(sticky.id)?.width).toBe(240)
  })

  test('a note switches between square and wide, keeping the edge on the anchored side', () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 120, y: 120 })
    editor.setStickyWide(sticky.id, true)
    const wide = expectDefined(editor.graph.getNode(sticky.id))
    expect([wide.x, wide.width, sublayers(editor, wide).body.width]).toEqual([0, 416, 376])
    editor.setStickyWide(sticky.id, false, 'right')
    expect(editor.graph.getNode(sticky.id)).toMatchObject({ x: 176, width: 240 })
    editor.undo.undo()
    expect(editor.graph.getNode(sticky.id)).toMatchObject({ x: 0, width: 416 })
  })

  test('a new text size keeps the body in its typeface, as Scribbled sets no tracking', () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 0, y: 0 })
    editor.graph.updateNode(sublayers(editor, sticky).body.id, { fontFamily: 'Figma Hand' })
    editor.setStickyTextSize([sticky.id], 'large')
    expect(sublayers(editor, sticky).body).toMatchObject({ fontSize: 40, letterSpacing: percentLength(0) })
  })

  test("typing in a note's body renames a note that was never renamed", () => {
    const { editor, pageId } = setup()
    const sticky = editor.createStickyNote(pageId, { x: 0, y: 0 })
    const { body, author } = sublayers(editor, sticky)
    applyGeneratedTextNameEdit(editor, body.id, 'Hello')
    expect(editor.graph.getNode(sticky.id)?.name).toBe('Hello')
    applyGeneratedTextNameEdit(editor, author.id, 'Someone')
    expect(editor.graph.getNode(sticky.id)?.name).toBe('Hello')
    editor.renameNode(sticky.id, 'Kept')
    applyGeneratedTextNameEdit(editor, body.id, 'Changed')
    expect(editor.graph.getNode(sticky.id)?.name).toBe('Kept')
    editor.undo.undo()
    expect(editor.graph.getNode(sticky.id)?.autoRename).toBe(true)
  })
})
