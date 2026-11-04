import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'

import { createPageLayouts } from '#core/editor/pages/layouts'
import { getTextMeasurer, setTextMeasurer } from '#core/layout/text-measurement'

const initialMeasurer = getTextMeasurer()
afterEach(() => setTextMeasurer(initialMeasurer))

/** An editor with two pages, each holding a card, and a page laid out on the first. */
function laidOutFirstPage() {
  const editor = createEditor()
  const first = editor.state.currentPageId
  const second = editor.graph.addPage('Second').id
  const card = editor.graph.createNode('FRAME', first, { name: 'Card', width: 100, height: 50 })
  const otherCard = editor.graph.createNode('FRAME', second, { name: 'Card', width: 100 })
  const layouts = createPageLayouts(editor)
  layouts.record(first)
  return { editor, first, card, otherCard, layouts }
}

describe('a page laid out before', () => {
  test('stays laid out until a layer on it changes', () => {
    const { editor, first, card, layouts } = laidOutFirstPage()
    expect(layouts.isCurrent(first)).toBe(true)

    editor.graph.updateNode(card.id, { width: 120 })

    expect(layouts.isCurrent(first)).toBe(false)
    editor.dispose()
  })

  test("stays laid out through layout's own writes and edits on other pages", () => {
    const { editor, first, card, otherCard, layouts } = laidOutFirstPage()

    editor.graph.withLayoutMutations(() => editor.graph.updateNode(card.id, { height: 60 }))
    editor.graph.updateNode(otherCard.id, { width: 140 })

    expect(layouts.isCurrent(first)).toBe(true)
    editor.dispose()
  })

  test('needs layout again once the text measurer changes', () => {
    const { editor, first, layouts } = laidOutFirstPage()

    setTextMeasurer(() => ({ width: 10, height: 10 }))

    expect(layouts.isCurrent(first)).toBe(false)
    editor.dispose()
  })

  test('needs layout again in a replaced document, whose pages can share ids', () => {
    const { editor, first, layouts } = laidOutFirstPage()

    editor.replaceGraph(new SceneGraph())

    expect(layouts.isCurrent(first)).toBe(false)
    editor.dispose()
  })

  test('was never laid out until recorded', () => {
    const { editor, layouts } = laidOutFirstPage()
    const third = editor.graph.addPage('Third').id

    expect(layouts.isCurrent(third)).toBe(false)
    editor.dispose()
  })
})
