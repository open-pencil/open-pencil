import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'

let editor: Editor

afterEach(() => editor.dispose())

/** A section holding a top-level auto layout frame of rows of cards, as the shadcn kit lays swatches out. */
function swatchRows() {
  editor = createEditor()
  const pageId = editor.state.currentPageId
  const section = editor.graph.createNode('SECTION', pageId, { width: 800, height: 300 })
  const rows = editor.graph.createNode('FRAME', section.id, {
    x: 40,
    y: 40,
    width: 700,
    height: 200,
    layoutMode: 'VERTICAL',
    fills: []
  })
  const row = editor.graph.createNode('FRAME', rows.id, {
    width: 700,
    height: 80,
    layoutMode: 'HORIZONTAL',
    fills: []
  })
  const card = editor.graph.createNode('FRAME', row.id, {
    width: 120,
    height: 80,
    layoutMode: 'VERTICAL',
    fills: []
  })
  const swatch = editor.graph.createNode('RECTANGLE', card.id, { width: 120, height: 60 })
  return { section, rows, row, card, swatch }
}

describe('enterContainerOf', () => {
  test('enters the parent of a nested layer, as a double-click reached it', () => {
    const { card, swatch, row } = swatchRows()
    editor.enterContainerOf(swatch.id)
    expect(editor.state.enteredContainerId).toBe(card.id)
    editor.enterContainerOf(card.id)
    expect(editor.state.enteredContainerId).toBe(row.id)
  })

  test('never enters a container a click looks into by itself, nor the page', () => {
    const { rows, row, section } = swatchRows()
    editor.enterContainerOf(row.id)
    expect(editor.state.enteredContainerId).toBeNull()
    editor.enterContainerOf(rows.id)
    expect(editor.state.enteredContainerId).toBeNull()
    editor.enterContainerOf(section.id)
    expect(editor.state.enteredContainerId).toBeNull()
  })

  test('enters a top-level frame on a board, where frames stay closed', () => {
    const { rows, row } = swatchRows()
    editor.setDocumentKind('board')
    editor.enterContainerOf(row.id)
    expect(editor.state.enteredContainerId).toBe(rows.id)
  })

  test('exitContainers leaves every entered container', () => {
    const { swatch } = swatchRows()
    editor.enterContainerOf(swatch.id)
    editor.exitContainers()
    expect(editor.state.enteredContainerId).toBeNull()
  })
})
