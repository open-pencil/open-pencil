import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

const VIEWPORT = { width: 800, height: 600 }

// Figma's N and Shift+N.
describe('frame navigation', () => {
  function frames() {
    const editor = createEditor({ getViewportSize: () => VIEWPORT })
    const pageId = editor.state.currentPageId
    const right = editor.graph.createNode('FRAME', pageId, {
      x: 600,
      y: 0,
      width: 100,
      height: 100
    })
    const left = editor.graph.createNode('FRAME', pageId, { x: 0, y: 0, width: 100, height: 100 })
    const section = editor.graph.createNode('SECTION', pageId, { x: 200, y: 0, width: 300 })
    const inSection = editor.graph.createNode('COMPONENT', section.id, {
      x: 100,
      y: 0,
      width: 100,
      height: 100
    })
    editor.graph.createNode('RECTANGLE', pageId, { x: 100, y: 0, width: 10, height: 10 })
    editor.graph.createNode('FRAME', pageId, { x: 50, y: 0, visible: false })
    return { editor, left, inSection, right }
  }

  test('steps through visible top-level frames left to right, into sections, and wraps', () => {
    const { editor, left, inSection, right } = frames()

    editor.zoomToNextFrame()
    expect(editor.state.selectedIds).toEqual(new Set([left.id]))
    editor.zoomToNextFrame()
    expect(editor.state.selectedIds).toEqual(new Set([inSection.id]))
    editor.zoomToNextFrame()
    expect(editor.state.selectedIds).toEqual(new Set([right.id]))
    editor.zoomToNextFrame()
    expect(editor.state.selectedIds).toEqual(new Set([left.id]))
  })

  test('previous starts at the last frame and continues from a selected child', () => {
    const { editor, inSection, right } = frames()

    editor.zoomToPreviousFrame()
    expect(editor.state.selectedIds).toEqual(new Set([right.id]))

    const child = editor.graph.createNode('RECTANGLE', right.id, { width: 10, height: 10 })
    editor.select([child.id])
    editor.zoomToPreviousFrame()
    expect(editor.state.selectedIds).toEqual(new Set([inSection.id]))
  })

  test('zooms to the frame it selects', () => {
    const { editor, right } = frames()
    editor.zoomToPreviousFrame()
    const { panX, panY, zoom } = editor.state
    const centerX = (VIEWPORT.width / 2 - panX) / zoom
    const centerY = (VIEWPORT.height / 2 - panY) / zoom
    expect(centerX).toBeCloseTo(right.x + right.width / 2)
    expect(centerY).toBeCloseTo(right.y + right.height / 2)
  })
})
