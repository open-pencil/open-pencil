import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'

const VIEWPORT = { width: 800, height: 600 }

function layerTree() {
  const editor = createEditor({ getViewportSize: () => VIEWPORT })
  const pageId = editor.state.currentPageId
  const frame = editor.graph.createNode('FRAME', pageId, { name: 'Frame' })
  const bottom = editor.graph.createNode('RECTANGLE', frame.id, { name: 'Bottom' })
  const middle = editor.graph.createNode('ELLIPSE', frame.id, { name: 'Middle' })
  const top = editor.graph.createNode('TEXT', frame.id, { name: 'Top' })
  return { editor, pageId, frame, bottom, middle, top }
}

// Figma help, Select layers and objects: Enter, Shift+Enter, Tab, and Shift+Tab.
describe('keyboard layer navigation', () => {
  test('selectChildren selects every child of the selected layer', () => {
    const { editor, frame, bottom, middle, top } = layerTree()
    editor.select([frame.id])

    editor.selectChildren()

    expect(editor.state.selectedIds).toEqual(new Set([bottom.id, middle.id, top.id]))
  })

  test('selectChildren keeps a selection without children', () => {
    const { editor, middle } = layerTree()
    editor.select([middle.id])

    editor.selectChildren()

    expect(editor.state.selectedIds).toEqual(new Set([middle.id]))
  })

  test('selectParent selects the parent and stops at the page', () => {
    const { editor, frame, middle } = layerTree()
    editor.select([middle.id])

    editor.selectParent()
    expect(editor.state.selectedIds).toEqual(new Set([frame.id]))

    editor.selectParent()
    expect(editor.state.selectedIds).toEqual(new Set([frame.id]))
  })

  test('next sibling goes down the layers panel and wraps', () => {
    const { editor, bottom, middle, top } = layerTree()
    editor.select([top.id])

    editor.selectNextSibling()
    expect(editor.state.selectedIds).toEqual(new Set([middle.id]))
    editor.selectNextSibling()
    expect(editor.state.selectedIds).toEqual(new Set([bottom.id]))
    editor.selectNextSibling()
    expect(editor.state.selectedIds).toEqual(new Set([top.id]))
  })

  test('previous sibling goes up the layers panel and wraps', () => {
    const { editor, bottom, top } = layerTree()
    editor.select([top.id])

    editor.selectPreviousSibling()
    expect(editor.state.selectedIds).toEqual(new Set([bottom.id]))
  })
})
