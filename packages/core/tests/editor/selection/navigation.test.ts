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

  // Measured in Figma 126 (scratch/pr-oracle/nav-keys.ts): Enter on a frame's children selects a
  // group's children in the group's place and keeps the layers without children.
  test('selectChildren opens the layers that have children and keeps the others', () => {
    const { editor, frame, bottom, top } = layerTree()
    const group = editor.graph.createNode('GROUP', frame.id, { name: 'Group' })
    const inside = editor.graph.createNode('RECTANGLE', group.id, { name: 'Inside' })
    editor.select([bottom.id, group.id, top.id])

    editor.selectChildren()

    expect(editor.state.selectedIds).toEqual(new Set([bottom.id, inside.id, top.id]))
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
