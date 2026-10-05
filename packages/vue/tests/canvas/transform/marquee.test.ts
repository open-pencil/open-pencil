import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core/editor'

import { handleMarqueeMove } from '#vue/canvas/transform/marquee'

let editor: Editor

afterEach(() => editor.dispose())

function marquee(from: [number, number], to: [number, number], containerId?: string) {
  editor.clearSelection()
  handleMarqueeMove(editor, { type: 'marquee', startX: from[0], startY: from[1], containerId }, ...to)
  return [...editor.state.selectedIds]
}

describe('marquee selection', () => {
  test('on the page, encloses a rotated frame by its drawn bounds', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    // 200×100 turned a quarter about its center: drawn at x 50…150, y −50…150.
    const frame = editor.graph.createNode('FRAME', page, { width: 200, height: 100, rotation: 90 })
    editor.graph.createNode('RECTANGLE', frame.id, { width: 20, height: 20 })
    expect(marquee([-10, -10], [210, 110])).toEqual([])
    expect(marquee([40, -60], [160, 160])).toEqual([frame.id])
  })

  test('inside a rotated frame, selects the children the marquee touches on the canvas', () => {
    editor = createEditor()
    const page = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', page, { width: 200, height: 100, rotation: 90 })
    // Local (150…180, 40…60) is drawn near the bottom of the turned frame, around y 100…130.
    const child = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 150,
      y: 40,
      width: 30,
      height: 20
    })
    expect(marquee([60, 90], [140, 140], frame.id)).toEqual([child.id])
    expect(marquee([60, -40], [140, 0], frame.id)).toEqual([])
  })
})
