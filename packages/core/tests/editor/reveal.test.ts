import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

function setup() {
  const editor = createEditor({ getViewportSize: () => ({ width: 800, height: 600 }) })
  const pageId = editor.state.currentPageId
  return { editor, pageId }
}

describe('revealNodes', () => {
  test('leaves the viewport alone when the layers are already in view', () => {
    const { editor, pageId } = setup()
    const card = editor.graph.createNode('FRAME', pageId, {
      x: 100,
      y: 100,
      width: 200,
      height: 100
    })

    editor.revealNodes([card.id])

    expect([editor.state.panX, editor.state.panY, editor.state.zoom]).toEqual([0, 0, 1])
  })

  test('centers off-screen layers that fit without changing zoom', () => {
    const { editor, pageId } = setup()
    const card = editor.graph.createNode('FRAME', pageId, {
      x: 2000,
      y: 1000,
      width: 200,
      height: 100
    })

    editor.revealNodes([card.id])

    expect(editor.state.zoom).toBe(1)
    expect(2100 + editor.state.panX).toBe(400)
    expect(1050 + editor.state.panY).toBe(300)
  })

  test('zooms out only when the layers do not fit', () => {
    const { editor, pageId } = setup()
    const wide = editor.graph.createNode('FRAME', pageId, { x: 0, y: 0, width: 3000, height: 100 })

    editor.revealNodes([wide.id])

    expect(editor.state.zoom).toBeLessThan(1)
    expect(3000 * editor.state.zoom).toBeLessThanOrEqual(800)
  })
})
