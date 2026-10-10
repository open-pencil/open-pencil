import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { layoutSizing } from '@open-pencil/scene-graph'

/** A Hug row with padding and gap 10 around a 60 × 40 and a 50 × 30 rectangle. */
function row() {
  const editor = createEditor()
  const { graph } = editor
  const parent = graph.createNode('FRAME', editor.state.currentPageId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    itemSpacing: 10,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10
  })
  const first = graph.createNode('RECTANGLE', parent.id, { width: 60, height: 40 })
  const second = graph.createNode('RECTANGLE', parent.id, { width: 50, height: 30 })
  editor.runLayoutForNode(parent.id)
  return { editor, parent, first, second }
}

// Places and sizes read from Figma desktop 126 with the same layers.
describe('ignoring auto layout', () => {
  test('keeps the layer where it is and closes the gap, in one undo step', () => {
    const { editor, parent, second } = row()
    expect([parent.width, second.x, second.y]).toEqual([140, 80, 10])
    editor.setLayoutPositioning([second.id], 'ABSOLUTE')
    expect([parent.width, second.x, second.y]).toEqual([80, 80, 10])
    editor.undoAction()
    expect([second.layoutPositioning, parent.width]).toEqual(['AUTO', 140])
    editor.redoAction()
    editor.setLayoutPositioning([second.id], 'AUTO')
    expect([parent.width, second.x, parent.childIds.indexOf(second.id)]).toEqual([140, 80, 1])
    editor.dispose()
  })

  test('a Fill layer reads Fixed while it ignores the layout and fills again when back', () => {
    const { editor, parent, second } = row()
    editor.updateNodeWithUndo(parent.id, { primaryAxisSizing: 'FIXED', width: 300 })
    editor.updateNodeWithUndo(second.id, { layoutGrow: 1 })
    expect(second.width).toBe(210)
    editor.setLayoutPositioning([second.id], 'ABSOLUTE')
    expect([second.width, layoutSizing(editor.graph, second, 'HORIZONTAL')]).toEqual([210, 'FIXED'])
    editor.setLayoutPositioning([second.id], 'AUTO')
    expect(layoutSizing(editor.graph, second, 'HORIZONTAL')).toBe('FILL')
    editor.dispose()
  })

  test('records nothing for layers outside an auto layout or already set', () => {
    const { editor, parent, second } = row()
    editor.setLayoutPositioning([parent.id, second.id], 'AUTO')
    expect(editor.undo.canUndo).toBe(false)
    editor.dispose()
  })
})
