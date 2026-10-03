import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

const VIEWPORT = { width: 800, height: 600 }

/** The world point at the center of the viewport. */
function center(editor: ReturnType<typeof createEditor>) {
  const { panX, panY, zoom } = editor.state
  return { x: (VIEWPORT.width / 2 - panX) / zoom, y: (VIEWPORT.height / 2 - panY) / zoom }
}

describe('zoomToLevel', () => {
  test.each([0.5, 1, 4])('keeps the centered point in place when zooming from 2 to %p', (level) => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    editor.state.zoom = 2
    editor.state.panX = -300
    editor.state.panY = 120
    const before = center(editor)

    editor.zoomToLevel(level)

    expect(editor.state.zoom).toBe(level)
    expect(center(editor)).toEqual(before)
  })
})

describe('centerOn', () => {
  test('puts the point at the center at the given zoom', () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    editor.centerOn(300, 200, 2)
    expect(editor.state.zoom).toBe(2)
    expect(center(editor)).toEqual({ x: 300, y: 200 })
  })

  test('leaves the view alone for a point too far away to represent', () => {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    const before = { ...center(editor), zoom: editor.state.zoom }
    editor.centerOn(1e308, 0, 256)
    expect({ ...center(editor), zoom: editor.state.zoom }).toEqual(before)
  })
})
